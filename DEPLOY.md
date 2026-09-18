# Deploying ilovedoc.org

Production deployment guide. The app is three processes plus a reverse proxy:

| Process | What | Port (example) |
|---|---|---|
| `web` | Next.js (`next start`, standalone output) | 3000 |
| `signaling` | Bun + socket.io mini-service (`mini-services/signaling`) | 3003 |
| `coturn` | TURN relay (only if you run your own) | 3478/udp + 5349/tls |
| proxy | Caddy or nginx, TLS termination | 80/443 |

## 1. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite path today (`file:./db/custom.db`); switch to `postgresql://…` for multi-instance |
| `CODE_PEPPER` | ✅ in prod | Random secret for share-code/token hashing. **Set a unique value; rotating it invalidates all in-flight transfers.** |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | ⬜ | Served by `GET /api/ice`. Without TURN, transfers behind symmetric NAT / strict firewalls fail (no relay fallback). |
| `DB_PATH` | ⬜ | Signaling service SQLite path (default from repo layout) |
| `SIGNALING_LOG` | ⬜ | Signaling log file override |

Generate a pepper: `openssl rand -hex 32`.

## 2. Build & run

```bash
# web (Next.js standalone output is already configured)
bun install
bunx prisma db push        # or prisma migrate deploy with a migrations dir
bun run build              # emits .next/standalone
NODE_ENV=production node .next/standalone/server.js   # listens on 3000

# signaling
cd mini-services/signaling
bun install
bun run start              # or: bun index.ts — listens on 3003, path '/'
```

Both processes are stateless except for their SQLite file (or shared Postgres).
Run them under systemd / supervisord / containers with restart policies.

## 3. Reverse proxy

One public origin, two upstreams. WebSocket upgrade headers must reach the
signaling service. Caddy example (automatic HTTPS):

```caddyfile
ilovedoc.org {
    encode zstd gzip

    handle /socket.io/* {
        reverse_proxy 127.0.0.1:3003
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

nginx equivalent: `location /socket.io/ { proxy_pass http://127.0.0.1:3003; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; … }`

> The frontend computes the signaling URL once (`src/lib/transfer/signaling.ts`)
> — in production it resolves to the same origin, so no CORS configuration is
> needed. The `?XTransformPort` query seen in this sandbox is a
> sandbox-gateway-only concern and never ships to production.

## 4. TURN (relay fallback)

Without TURN the product is honest but incomplete: some network pairs simply
cannot establish direct WebRTC connections. Options:

- Managed: Twilio/Electric/Xirsys/metered.ca TURN service — set the three
  `TURN_*` env vars, done.
- Self-hosted coturn:

  ```
  listening-port=3478
  tls-listening-port=5349
  fingerprint
  lt-cred-mech
  use-auth-secret
  static-auth-secret=<openssl rand -hex 32>
  realm=ilovedoc.org
  total-quota=1200
  user-quota=12
  no-multicast-peers
  no-cli
  cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
  pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
  ```

  Generate time-limited credentials server-side (HMAC of expiry with the
  static-auth-secret) and serve them from `GET /api/ice`.

TURN bandwidth is the only real cost of this architecture — everything else
is metadata.

## 5. Database: SQLite → Postgres

SQLite (single file, WAL) is fine for a single-box deployment of this shape:
the DB only stores transfer metadata, share-code hashes, and event logs, and
rows expire within hours to days (cleanup tasks run in both services).

Move to Postgres when you need: more than one `web` instance (session
handoff), more than one signaling instance (needs sticky sessions or Redis
adapter), or HA. The Prisma schema is portable — change the provider, adjust
`DateTime` handling if needed, run `prisma db push` against the new database,
and update both `DATABASE_URL` (web) and `DB_PATH`/queries (signaling uses
raw SQL with SQLite-specific time handling — see
`mini-services/signaling/src/db.ts`).

## 6. Operational notes

- **Expiry/cleanup**: both services run background sweepers for expired
  transfers; they use wall-clock expiry (`expiresAt`), so NTP matters.
- **Backups**: only `db/custom.db` (metadata) is state worth backing up —
  and even losing it merely drops in-flight sessions, never user files
  (files never touch the server).
- **Logs**: web logs to stdout; signaling to `signaling.log` or stdout.
  `TransferEvent` rows double as an audit trail (kind/role/state metadata
  only — never file contents or credentials).
- **Security headers** (CSP, HSTS, etc.) ship from `next.config.ts` — the
  proxy must NOT strip them. In production you can tighten CSP further by
  removing the dev-only `'unsafe-eval'`.
- **Rate limits** are in-memory per process (see SPEC §4). Multi-instance
  deployments should front them with a shared limiter or accept per-node
  granularity.
