# Task 4 — Transfer flow UI panels (full-stack-developer)

Work record for Task ID 4: the visual heart of ilovedoc.org — transfer flow
panels consuming the Task 3 WebRTC hooks.

## Scope

Only files in `src/components/transfer/` were created. Nothing else was
modified (page.tsx / layout.tsx / globals.css / hooks / lib / site / API all
untouched).

## Files created

| File | Exports | Notes |
|---|---|---|
| `transfer-widget.tsx` | `TransferWidget` (props: `className?`) | Orchestrator: `<section id="transfer" className="scroll-mt-24 …">`, shadcn Tabs (Send/Receive), sonner `<Toaster richColors position="top-center" />` (theme tracks the manual `.dark` class via `useSyncExternalStore` + MutationObserver), sr-only `aria-live` mode announcement |
| `send-panel.tsx` | `SendPanel` () | Full sender flow on `useSendTransfer()` |
| `receive-panel.tsx` | `ReceivePanel` (props: `registerController?: (api: ReceiveControllerApi) => void`), `ReceiveControllerApi = { startByToken(token: string): void; startByCode(code: string): void }` | Full receiver flow on `useReceiveTransfer()` |
| `progress-panel.tsx` | `ProgressPanel` (props: `progress: SenderState \| ReceiverState`, `variant: 'sending' \| 'receiving'`, `className?`) and `ConnectionSteps` (props: `steps: readonly string[]`, `className?`) | Shared live progress + animated connecting checklist |
| `connection-badge.tsx` | `ConnectionBadge` (props: `kind: 'direct' \| 'relay' \| 'unknown'`, `className?`) | Honest direct/relay pill with tooltips; never claims direct when relay |
| `qr-dialog.tsx` | default export `QrDialog` (props: `open`, `onOpenChange`, `url`) | For `next/dynamic(() => import('./qr-dialog'), { ssr: false })`; QR generated with `qrcode` `toDataURL` in useEffect |
| `file-icon.tsx` | `FileIcon` (props: `name`, `mimeType?`, `className?`) | ext/mime → lucide icon + muted colors (no blue/indigo/purple) |

## Key wiring decisions

- **Both panels always mounted**: `TabsContent` uses Radix `forceMount`
  (element keeps the HTML `hidden` attribute when inactive) plus
  `data-[state=inactive]:hidden` — an in-flight transfer survives tab switches.
- **`ilovedoc:mode` CustomEvent** (dispatched by hero/header CTAs): widget
  listens on `window`, validates detail `'send' | 'receive'`, switches tabs.
- **URL share params** (once on mount, ref-guarded): `?t=<token>`
  (validated `^[A-Za-z0-9]{6,32}$`) → `startByToken(token)`; `?code=<6
  digits>` → `startByCode`. Tab switch reuses the same `ilovedoc:mode`
  channel, then smooth-scrolls to `#transfer` (respects prefers-reduced-motion).
- **Single receive hook instance**: the hook lives inside `ReceivePanel`; the
  widget gets `startByToken`/`startByCode` via the `registerController` prop
  (child effects run before parent effects, so the ref is populated before
  the widget's URL-param effect runs).
- **Accept Files user-gesture safety**: `onClick={() => void accept(diskAvailable ? saveToDisk : false)}`
  — nothing awaited before the call (File System Access pickers need the gesture).
- **Hydration safety**: all capability gating (`webrtcSupported`,
  `fsAccessSupported`, `webkitdirectory`, `.dark` class) reads through
  `useSyncExternalStore` with server snapshots; countdowns start `null`.
  The repo ESLint rule `react-hooks/set-state-in-effect` is fully satisfied
  (no synchronous setState in effects).
- **Design**: rose-600 / dark:rose-500 primaries, slate neutrals, rounded-2xl
  cards, explicit dark variants everywhere, ≥44px touch targets
  (h-11/h-12/h-13 tab list), `tabular-nums` for all numbers, custom thin
  scrollbars on `max-h-72` file lists, semantic headings (widget h2 → panel h3),
  aria-labels on icon-only buttons, `role="progressbar"` via Radix Progress
  with `aria-label`s, sonner toasts for copy actions.
- **lucide-react 0.525 naming**: uses `LoaderCircle` (not Loader2),
  `CircleCheckBig`, `TriangleAlert`, `CloudUpload`, `CircleX` — deprecated
  aliases were removed in this version.

## Verification

- `bun run lint` → CLEAN (whole repo, zero warnings).
- `bunx tsc --noEmit` → CLEAN.
- SSR smoke test (`react-dom/server` renderToString of `TransferWidget`):
  renders `#transfer` section with both panels in the HTML (dropzone + code
  input), no crash.
- `dev.log`: no new errors (only pre-existing Geist font-download warnings
  from layout.tsx due to the sandbox network).
- Dev server untouched (no restart/build).

## Handoff to Task 5 (page assembly)

```tsx
import { TransferWidget } from "@/components/transfer/transfer-widget";
// SiteHeader → Hero → <TransferWidget /> → HowItWorks → SecuritySection → Faq → Footer
```

The widget carries its own `id="transfer"` + `scroll-mt-24` + section heading
+ sonner Toaster. No other integration points needed.
