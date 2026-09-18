import type { Metadata } from "next"

import { JsonLd } from "@/components/site/landing/json-ld"
import { LegalPage } from "@/components/site/legal/legal-page"
import {
  Callout,
  LDl,
  LH3,
  LLi,
  LP,
  LUl,
} from "@/components/site/legal/legal-content"

const SITE_URL = "https://ilovedoc.org"
const PAGE_URL = `${SITE_URL}/legal/terms`
const LAST_UPDATED = "September 18, 2026"

const PAGE_TITLE = "Terms of Service"
const PAGE_DESCRIPTION =
  "The rules for using I Love Doc's browser-to-browser file transfer service: how ephemeral sessions work, acceptable use, and the limits of a service that never stores your files."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/legal/terms",
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

export default function TermsPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LegalPage
        active="terms"
        crumb="Terms of Service"
        title="Terms of Service"
        description="These terms govern your use of I Love Doc. They're written to be read — the service is built on a few simple ideas, and the rules follow from them."
        lastUpdated={LAST_UPDATED}
        contact={{
          label: "Questions about these terms",
          email: "legal@ilovedoc.org",
          note:
            "If anything in this document is unclear, or you need to reach us about a legal matter, write to",
        }}
        siblings={[
          {
            href: "/legal/privacy",
            label: "Privacy Policy",
            description:
              "Exactly what our servers process, what they never touch, and when records are deleted.",
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
            id: "agreement",
            title: "Agreement to these terms",
            content: (
              <>
                <LP>
                  I Love Doc (&ldquo;<strong>I Love Doc</strong>&rdquo;,
                  &ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;)
                  operates <strong>ilovedoc.org</strong> (the
                  &ldquo;<strong>Service</strong>&rdquo;) — a website that
                  transfers files directly from one web browser to another. By
                  accessing or using the Service, you agree to these Terms of
                  Service (&ldquo;<strong>Terms</strong>&rdquo;). If you do not
                  agree, do not use the Service.
                </LP>
                <LP>
                  You also confirm that you are legally able to form a binding
                  contract, and — where required by the law that applies to you
                  — that you have the consent of a parent or guardian.
                </LP>
              </>
            ),
          },
          {
            id: "the-service",
            title: "What the Service does",
            content: (
              <>
                <LP>
                  I Love Doc moves files <strong>directly between two
                  browsers</strong> over an encrypted WebRTC connection. Our
                  servers coordinate the connection — they issue a share link
                  and code, verify the parties to each other, and help the two
                  browsers find a direct route. The file data itself travels
                  between the two devices and, in the normal (direct) case,{" "}
                  <strong>never passes through our servers</strong>. Where a
                  network blocks direct connections, traffic may be relayed
                  through an encrypted relay; the app always labels when that
                  happens.
                </LP>
                <LDl
                  items={[
                    {
                      term: "Sessions, not storage",
                      def: "A transfer is a temporary session between two online browsers. Nothing is uploaded to a cloud drive, and there is no file archive to log into later.",
                    },
                    {
                      term: "Limits",
                      def: "Up to 200 files per transfer and up to 10 TB per file. Multi-file downloads are bundled as a ZIP archive, which is limited to under 4 GB by the ZIP format itself.",
                    },
                    {
                      term: "Expiry",
                      def: "You choose how long a share link stays valid: 1 hour, 6 hours, 24 hours (the default), 3 days, or 7 days. After that the link and its 6-digit code stop working and cannot be revived.",
                    },
                    {
                      term: "Download limits",
                      def: "A sender can cap how many times a transfer can be received (1 to 10 times, 5 by default).",
                    },
                    {
                      term: "Optional password",
                      def: "Senders may protect a transfer with a password. Passwords are stored only as a salted scrypt hash — we never see the plaintext after it leaves your browser.",
                    },
                  ]}
                />
                <LP>
                  Because transfers happen live between browsers, the sender
                  must keep their tab open and their device awake for the
                  duration of the transfer. If the sender goes offline, the
                  transfer stops — there is no server copy to resume from.
                </LP>
              </>
            ),
          },
          {
            id: "no-accounts",
            title: "No accounts, no sign-up",
            content: (
              <LP>
                The Service requires no registration, no email address, and no
                profile. A transfer is identified only by its share link and
6-digit code. This also means{" "}
                <strong>
                  anyone who has the link, the code, and (if set) the password
                  can receive the files
                </strong>{" "}
                — treat your share link like a physical key. If a link falls
                into the wrong hands, your options are to let it expire, or to
                cancel the transfer from the sender&rsquo;s browser while it is
                still live.
              </LP>
            ),
          },
          {
            id: "your-content",
            title: "Your files remain yours",
            content: (
              <>
                <LP>
                  You retain all rights to everything you send. We claim{" "}
                  <strong>no license</strong> to your content — we cannot, in
                  the normal case, because your files never reach our servers
                  in the first place.
                </LP>
                <LP>
                  You are responsible for having the right to share the files
                  you send, and for whatever you send happening to be legal to
                  share in the jurisdictions of both parties.
                </LP>
              </>
            ),
          },
          {
            id: "acceptable-use",
            title: "Acceptable use",
            content: (
              <>
                <LP>
                  The Service may only be used for lawful purposes. You agree
                  not to use it to send, request, or distribute:
                </LP>
                <LUl>
                  <LLi>
                    content that infringes anyone&rsquo;s copyright or other
                    intellectual property (see our{" "}
                    <a href="/legal/dmca">DMCA &amp; Copyright Policy</a>);
                  </LLi>
                  <LLi>malware, ransomware, or other harmful code;</LLi>
                  <LLi>
                    any material that sexually exploits or endangers minors;
                  </LLi>
                  <LLi>
                    content that constitutes harassment, threats, doxxing, or
                    incitement to violence;
                  </LLi>
                  <LLi>
                    classified or controlled data you are not authorized to
                    transmit; or
                  </LLi>
                  <LLi>
                    anything whose transfer violates applicable export-control
                    or sanctions law.
                  </LLi>
                </LUl>
                <LP>
                  You also agree not to interfere with the Service itself — no
                  attempts to overload it, scrape it at scale, probe for
                  vulnerabilities without authorization, or circumvent rate
                  limits.
                </LP>
                <LH3>What we do about violations</LH3>
                <LUl>
                  <LLi>
                    terminate or expire sessions and share links we become
                    aware of;
                  </LLi>
                  <LLi>
                    block devices or network addresses from using the Service;
                  </LLi>
                  <LLi>
                    preserve and disclose session metadata where required by
                    law; and
                  </LLi>
                  <LLi>
                    report apparent criminal activity to the relevant
                    authorities.
                  </LLi>
                </LUl>
              </>
            ),
          },
          {
            id: "ephemeral",
            title: "Ephemeral by design",
            content: (
              <>
                <Callout title="There is no copy to fall back on">
                  Files exist in exactly two places during a transfer: the
                  sender&rsquo;s browser and the receiver&rsquo;s browser. Once
                  both sides finish and close, the Service has nothing — by
                  design.
                </Callout>
                <LP>
                  This has consequences you should understand before relying on
                  the Service:
                </LP>
                <LUl>
                  <LLi>
                    <strong>No recovery.</strong> If a transfer is interrupted
                    and the link has expired, or the sender&rsquo;s browser is
                    gone, the files cannot be retrieved through us. Keep your
                    own copies of anything important.
                  </LLi>
                  <LLi>
                    <strong>No delivery guarantee.</strong> The Service
                    coordinates; the internet does the carrying. We cannot
                    promise a given network will allow a direct connection or
                    that a transfer will complete.
                  </LLi>
                  <LLi>
                    <strong>Verification, not inspection.</strong> Both browsers
                    compute a SHA-256 hash of each file and compare them, so
                    you know the copy matches the original. We never see the
                    file or its hash on the server.
                  </LLi>
                </LUl>
              </>
            ),
          },
          {
            id: "third-party-infrastructure",
            title: "Third-party infrastructure",
            content: (
              <LP>
                Connecting two browsers across the internet uses standard
                WebRTC infrastructure: public STUN servers (operated by Google
                and Cloudflare) help browsers discover each other&rsquo;s
                addresses, and — only when a direct connection fails — an
                encrypted TURN relay operated by us or a provider we choose may
                carry the encrypted traffic. These third parties operate under
                their own privacy policies. The relay can see encrypted traffic
                and forwarding metadata, but cannot read file contents. See our{" "}
                <a href="/legal/privacy">Privacy Policy</a> for the full
                picture.
              </LP>
            ),
          },
          {
            id: "availability",
            title: "Availability and changes",
            content: (
              <LP>
                The Service is provided on an as-available basis. We may add,
                change, suspend, or discontinue any part of it at any time —
                including these limits and features — and we may do so without
                individual notice. Material changes to the Service or these
                Terms will be reflected on this page with a new
                &ldquo;last updated&rdquo; date.
              </LP>
            ),
          },
          {
            id: "warranties",
            title: "No warranties",
            content: (
              <LP>
                The Service is provided <strong>&ldquo;as is&rdquo;</strong>{" "}
                and <strong>&ldquo;as available&rdquo;</strong>, without
                warranties of any kind, whether express or implied — including
                implied warranties of merchantability, fitness for a particular
                purpose, and non-infringement. We do not warrant that the
                Service will be uninterrupted, error-free, secure, or that
                transfers will always complete or remain private in
                circumstances outside our control. We do not monitor, verify,
                or endorse the content users transfer.
              </LP>
            ),
          },
          {
            id: "liability",
            title: "Limitation of liability",
            content: (
              <LP>
                To the maximum extent permitted by applicable law, I Love Doc
                and its operators shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, or for
                any loss of data, profits, or goodwill, arising from or related
                to your use of the Service. Because the Service is provided
                free of charge, our aggregate liability for any claim relating
                to the Service is limited to the amount you have paid us for
                the Service — which is zero. Nothing in these Terms limits
                liability that cannot be limited by law, such as liability for
                willful misconduct or gross negligence where such limitation is
                prohibited.
              </LP>
            ),
          },
          {
            id: "indemnification",
            title: "Indemnification",
            content: (
              <LP>
                To the extent permitted by law, you agree to defend and
                indemnify I Love Doc against claims, damages, and expenses
                (including reasonable legal costs) arising from content you
                send, your use of the Service, or your violation of these Terms
                or applicable law.
              </LP>
            ),
          },
          {
            id: "law-disputes",
            title: "Governing law and disputes",
            content: (
              <LP>
                These Terms are governed by the laws of the jurisdiction where
                the operator of the Service is established, without regard to
                conflict-of-law rules. The courts of that jurisdiction have
                exclusive jurisdiction over any dispute arising from the
                Service — except that either party may bring a claim in the
                courts of the country where they reside if mandatory consumer
                protection law of that country gives them that right.
              </LP>
            ),
          },
          {
            id: "changes",
            title: "Changes to these terms",
            content: (
              <LP>
                We may update these Terms from time to time. The version in
                effect is the one published on this page with the most recent
                &ldquo;last updated&rdquo; date. If you keep using the Service
                after a change takes effect, you accept the updated Terms.
              </LP>
            ),
          },
        ]}
      />
    </>
  )
}
