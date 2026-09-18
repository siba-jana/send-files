import type { Metadata } from "next"
import { FileCheck2, ShieldCheck } from "lucide-react"

import { JsonLd } from "@/components/site/landing/json-ld"
import { LegalPage } from "@/components/site/legal/legal-page"
import {
  Callout,
  LDl,
  LH3,
  LLi,
  LP,
  LUl,
  LegalTable,
} from "@/components/site/legal/legal-content"

const SITE_URL = "https://ilovedoc.org"
const PAGE_URL = `${SITE_URL}/legal/privacy`
const LAST_UPDATED = "September 18, 2026"

const PAGE_TITLE = "Privacy Policy"
const PAGE_DESCRIPTION =
  "What I Love Doc's servers actually process — transfer metadata, hashed credentials, rate limits — and what they never touch: file contents, passwords in plaintext, cookies, and trackers."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/legal/privacy",
  },
  openGraph: {
    title: `${PAGE_TITLE} · ilovedoc.org`,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "I Love Doc",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1216,
        height: 640,
        alt: "I Love Doc — send files directly from browser to browser",
      },
    ],
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "I Love Doc",
    },
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: `${PAGE_TITLE} — I Love Doc`,
      description: PAGE_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      dateModified: "2026-09-18",
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: PAGE_TITLE,
          item: PAGE_URL,
        },
      ],
    },
  ],
}

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LegalPage
        active="privacy"
        crumb="Privacy Policy"
        title="Privacy Policy"
        description="This policy explains exactly what our servers process when you use I Love Doc, what they never receive, and when each record is deleted. It is written to match how the software actually behaves — not how privacy policies usually sound."
        lastUpdated={LAST_UPDATED}
        intro={
          <Callout title="The short version" icon={ShieldCheck}>
            <strong>
              Your files never touch our servers, and we cannot read them.
            </strong>{" "}
            Files travel directly between the two browsers over an
            end-to-end encrypted WebRTC connection. We never store file
            contents, we set no cookies, we run no analytics or ads, and we
            collect no names, emails, or accounts. The little metadata a
            transfer needs is deleted automatically within 7 days of the
            transfer expiring.
          </Callout>
        }
        contact={{
          label: "Privacy questions and requests",
          email: "legal@ilovedoc.org",
          note:
            "For any privacy question, or to request deletion of a specific record, write to",
        }}
        siblings={[
          {
            href: "/legal/terms",
            label: "Terms of Service",
            description:
              "The rules of the road: acceptable use, ephemerality, warranties, and liability.",
          },
          {
            href: "/legal/dmca",
            label: "DMCA & Copyright Policy",
            description:
              "How to report copyright concerns and what we can do about them.",
          },
        ]}
        sections={[
          {
            id: "who-we-are",
            title: "Who we are and what this covers",
            content: (
              <LP>
                I Love Doc operates <strong>ilovedoc.org</strong>, a
                browser-to-browser file transfer service. This policy covers
                the website, the transfer service, and the relay infrastructure
                we operate. It applies whenever you send or receive files, or
                simply browse the site. Where required by law (including the
                GDPR for users in the European Economic Area and the CCPA/CPRA
                for California residents), the operators of the Service act as
                the controller of the small amount of data described below.
              </LP>
            ),
          },
          {
            id: "never-receive",
            title: "What we never receive",
            content: (
              <>
                <LP>
                  Because transfers are peer-to-peer, entire categories of data
                  that most services collect simply do not exist here:
                </LP>
                <LUl>
                  <LLi>
                    <strong>File contents.</strong> Bytes travel over the
                    WebRTC data channel between the two browsers. Our servers
                    coordinate the connection; they do not carry the payload.
                  </LLi>
                  <LLi>
                    <strong>Plaintext passwords.</strong> If a sender protects
                    a transfer, the password is hashed in the sender&rsquo;s
                    browser with scrypt and a random salt. Only the hash is
                    sent to us — and only so the receiver&rsquo;s unlock can be
                    verified.
                  </LLi>
                  <LLi>
                    <strong>File integrity hashes.</strong> The SHA-256
                    fingerprints used to verify each file are computed on both
                    ends and compared between the browsers. They are not stored
                    on the server.
                  </LLi>
                  <LLi>
                    <strong>Identity data.</strong> No accounts, no email
                    addresses, no profiles, no contact lists. The only optional
                    personal input is a display name the sender may attach to a
                    transfer.
                  </LLi>
                  <LLi>
                    <strong>Browsing behavior.</strong> No analytics, no ads,
                    no session recorders, no fingerprinting scripts, no
                    third-party trackers of any kind.
                  </LLi>
                </LUl>
              </>
            ),
          },
          {
            id: "what-we-process",
            title: "What our servers process",
            content: (
              <>
                <LP>
                  A coordination server has to see something to coordinate.
                  Here is the complete inventory, with why each item exists and
                  how long it stays:
                </LP>
                <LegalTable
                  columns={["Data", "Why we need it", "Retention"]}
                  rows={[
                    [
                      "Transfer metadata (file names, sizes, types, file count, optional sender display name, download counter, expiry time)",
                      "Shows the recipient what is incoming and enforces the expiry and download limits the sender chose.",
                      "Deleted automatically within 7 days after the transfer expires.",
                    ],
                    [
                      "Hashed credentials (a SHA-256 hash of the 6-digit share code and of the sender/receiver session tokens; a scrypt hash of the optional password)",
                      "Lets the two browsers prove their roles to each other through the signaling service — without us ever knowing the secrets.",
                      "Deleted with the transfer record, within 7 days after expiry.",
                    ],
                    [
                      "Lifecycle events (timestamps of created / completed / expired, plus file counts and total sizes)",
                      "Powers the honest aggregate counters on the home page and helps us debug the service. No content, no personal identifiers.",
                      "Deleted with the transfer record.",
                    ],
                    [
                      "IP addresses",
                      "Rate limiting (e.g. transfer creation and unlock attempts per address) and abuse prevention. Kept in memory only, for the duration of the rate-limit window (minutes).",
                      "Minutes, in memory. Gateway/server access logs that contain IPs are kept only as long as operationally necessary for security.",
                    ],
                    [
                      "Signaling messages (WebRTC session descriptions and network candidates exchanged between the two browsers)",
                      "Relayed between the two parties to establish the direct connection. Not written to the database.",
                      "Ephemeral — exists in memory during the handshake only.",
                    ],
                  ]}
                />
                <LP>
                  The public statistics shown on the home page (transfers
                  created, deliveries completed, files and bytes moved) are
                  aggregate totals that cannot identify any transfer or person.
                </LP>
              </>
            ),
          },
          {
            id: "how-files-travel",
            title: "How your files actually travel",
            content: (
              <>
                <LP>
                  I Love Doc uses WebRTC, the same standard that powers
                  browser video calls. Two things follow from that, and we
                  would rather explain them than gloss over them:
                </LP>
                <LDl
                  items={[
                    {
                      term: "The connection is end-to-end encrypted",
                      def: "WebRTC traffic is encrypted with DTLS between the two browsers. On the normal (direct) path, only those two devices ever see the file bytes. The app's connection badge shows \u201cDirect P2P\u201d when this is the case.",
                    },
                    {
                      term: "Peers can see each other's IP address",
                      def: "As with any direct connection, the sender and the receiver learn each other's network addresses during connection setup. That is inherent to connecting two browsers directly — it is also what removes the middleman from your file traffic.",
                    },
                    {
                      term: "STUN helps browsers find each other",
                      def: "We use public STUN servers (operated by Google and Cloudflare) for address discovery. Their operators can see that a connection attempt happened, but never any file data. Their own privacy policies apply to their infrastructure.",
                    },
                    {
                      term: "Relay fallback, honestly labeled",
                      def: "When a firewall or carrier-grade NAT blocks direct connections, traffic may be routed through an encrypted TURN relay. The relay forwards encrypted bytes it cannot decrypt, and the app's badge changes to \u201cSecure relay\u201d so you always know which path you are on.",
                    },
                  ]}
                />
              </>
            ),
          },
          {
            id: "on-your-device",
            title: "Data stored on your device",
            content: (
              <>
                <LP>
                  Some conveniences live entirely in your browser&rsquo;s local
                  storage. They are never transmitted to us, never leave your
                  device, and you can clear each of them from the app itself:
                </LP>
                <LDl
                  items={[
                    {
                      term: "ilovedoc:recent-v1",
                      def: "The sender's \u201crecent transfers\u201d list — a short local history of sessions you initiated, with a clear button in the app.",
                    },
                    {
                      term: "ilovedoc:received-v1",
                      def: "The receiver's \u201crecently received\u201d list — same idea, for sessions you accepted. Also clearable with one click.",
                    },
                    {
                      term: "theme",
                      def: "Whether you prefer light or dark mode.",
                    },
                  ]}
                />
              </>
            ),
          },
          {
            id: "no-cookies",
            title: "No cookies, no tracking",
            content: (
              <LP>
                The Service sets <strong>no cookies</strong> — there is no
                login to remember and nothing to track. We run no analytics or
                advertising SDKs, load no third-party scripts, and perform no
                cross-site tracking or fingerprinting. Even the fonts are
                self-hosted. The only third parties your browser talks to are
                the public STUN servers (and, only if a direct connection
                fails, the encrypted relay) as part of the WebRTC connection
                setup described above. The &ldquo;Do Not Track&rdquo; signal
                and browser privacy settings need no special handling here
                because there is nothing to opt out of.
              </LP>
            ),
          },
          {
            id: "retention",
            title: "Retention and deletion",
            content: (
              <>
                <LP>
                  Retention in the Service is mechanical, not aspirational:
                </LP>
                <LUl>
                  <LLi>
                    <strong>Expiry is enforced, not promised.</strong> Share
                    links stop working the moment they pass their expiry (1
                    hour to 7 days, as chosen by the sender). After that, the
                    session cannot be joined or resumed.
                  </LLi>
                  <LLi>
                    <strong>Metadata is purged automatically.</strong> A
                    scheduled sweep deletes every record of a transfer —
                    metadata rows, hashed credentials, and lifecycle events —{" "}
                    <strong>within 7 days after the transfer expires</strong>.
                    Deletion is cascading and permanent; nothing is moved to a
                    soft-delete state.
                  </LLi>
                  <LLi>
                    <strong>Rate-limit state lives in memory</strong> for
                    minutes and disappears on its own.
                  </LLi>
                  <LLi>
                    <strong>Device-local history</strong> (recent sends and
                    receives) stays until you clear it, because only your
                    browser ever had it.
                  </LLi>
                </LUl>
                <LP>
                  We may retain minimal records beyond this window where we are
                  legally required or permitted to (for example, to respond to
                  a lawful request or to investigate abuse), and standard
                  server access logs are kept only as long as operationally
                  necessary for security.
                </LP>
              </>
            ),
          },
          {
            id: "legal-bases",
            title: "Legal bases and your rights",
            content: (
              <>
                <LP>
                  If you are in the EEA, UK, or Switzerland, we process the
                  data described above on the grounds of{" "}
                  <strong>performance of a contract</strong> (running the
                  transfer you asked for) and{" "}
                  <strong>legitimate interest</strong> (rate limiting, abuse
                  prevention, and keeping the service secure and available).
                  If you are a California resident, the CCPA/CPRA applies; we
                  do not sell or share personal information as those terms are
                  defined, and there are no advertising cookies to opt out of.
                </LP>
                <LH3>What you can do</LH3>
                <LUl>
                  <LLi>
                    <strong>Let it expire.</strong> Most rights here are
                    exercised automatically: the data that identifies a
                    transfer is gone within 7 days of expiry, without anyone
                    asking.
                  </LLi>
                  <LLi>
                    <strong>Ask us.</strong> You may request access to or
                    deletion of a specific record while it still exists —
                    include the share link or code so we can find it — by
                    writing to{" "}
                    <a href="mailto:legal@ilovedoc.org">legal@ilovedoc.org</a>.
                  </LLi>
                  <LLi>
                    <strong>Complain.</strong> You have the right to lodge a
                    complaint with your local data protection authority.
                  </LLi>
                </LUl>
                <LP>
                  We do not carry out automated decision-making or profiling —
                  there is no profile to make decisions about.
                </LP>
              </>
            ),
          },
          {
            id: "children",
            title: "Children",
            content: (
              <LP>
                The Service is not directed to children under 13, or to EEA
                users under 16, and we do not knowingly process their personal
                data. Because there are no accounts, we have no way to know a
                user&rsquo;s age; if you believe a child has used the Service
                and want a record removed, write to{" "}
                <a href="mailto:legal@ilovedoc.org">legal@ilovedoc.org</a> —
                the normal retention sweep will in any case delete transfer
                metadata within 7 days of expiry.
              </LP>
            ),
          },
          {
            id: "international",
            title: "International transfers",
            content: (
              <LP>
                The Service is available globally, and a transfer can connect
                browsers in any two countries — that is rather the point. In
                the normal (direct) case, file data crosses whatever borders
                those two devices sit behind, without passing through us. The
                coordination data described above may be processed in the
                country where our servers are located; where that country is
                outside the EEA, UK, or Switzerland, we rely on the applicable
                safeguards for the limited, non-content metadata involved.
              </LP>
            ),
          },
          {
            id: "changes",
            title: "Changes to this policy",
            content: (
              <LP>
                If we change what the Service processes, we will update this
                page and its &ldquo;last updated&rdquo; date before the change
                takes effect. The current version is always published here:{" "}
                <a href="/legal/privacy">ilovedoc.org/legal/privacy</a>.
              </LP>
            ),
          },
        ]}
      />
    </>
  )
}
