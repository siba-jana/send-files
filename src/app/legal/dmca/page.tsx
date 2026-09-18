import type { Metadata } from "next"

import { JsonLd } from "@/components/site/landing/json-ld"
import { LegalPage } from "@/components/site/legal/legal-page"
import {
  CalloutWarning,
  LH3,
  LLi,
  LP,
  LUl,
} from "@/components/site/legal/legal-content"

const SITE_URL = "https://ilovedoc.org"
const PAGE_URL = `${SITE_URL}/legal/dmca`
const LAST_UPDATED = "September 18, 2026"

const PAGE_TITLE = "DMCA & Copyright Policy"
const PAGE_DESCRIPTION =
  "How to submit a copyright takedown notice or counter-notification to I Love Doc, and what an honest P2P service can — and cannot — do about transfers it never stores."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/legal/dmca",
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

export default function DmcaPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LegalPage
        active="dmca"
        crumb="DMCA & Copyright"
        title="DMCA & Copyright Policy"
        description="We respect copyright and we respond to valid takedown notices. This page explains how the process works — including what a peer-to-peer service without file storage can and cannot do."
        lastUpdated={LAST_UPDATED}
        intro={
          <CalloutWarning title="Read this first">
            I Love Doc transfers files directly between browsers and does not
            host or store files. We can terminate live sessions, disable share
            links, and block abusive senders — but there is no stored copy to
            remove, because no copy was ever made. This policy explains both
            halves honestly.
          </CalloutWarning>
        }
        contact={{
          label: "Copyright notices",
          email: "abuse@ilovedoc.org",
          note:
            "Send takedown notices and counter-notifications to this address with the subject line \u201cDMCA\u201d, or write to",
        }}
        siblings={[
          {
            href: "/legal/terms",
            label: "Terms of Service",
            description:
              "The rules of the road: acceptable use, ephemerality, warranties, and liability.",
          },
          {
            href: "/legal/privacy",
            label: "Privacy Policy",
            description:
              "Exactly what our servers process, what they never touch, and when records are deleted.",
          },
        ]}
        sections={[
          {
            id: "policy",
            title: "Our position",
            content: (
              <LP>
                I Love Doc (&ldquo;we&rdquo;, &ldquo;us&rdquo;) responds to
                notices of alleged copyright infringement that comply with the
                Digital Millennium Copyright Act (&ldquo;DMCA&rdquo;), 17
                U.S.C. § 512, and with equivalent notice procedures under
                other applicable laws. We reserve the right to act on notices
                that do not strictly meet statutory formality requirements
                where the claim is otherwise clear.
              </LP>
            ),
          },
          {
            id: "nature-of-service",
            title: "What we can and cannot do",
            content: (
              <>
                <LP>
                  The Service is a pipe, not a warehouse: files move live from
                  a sender&rsquo;s browser to a receiver&rsquo;s browser and
                  are never stored on our infrastructure. When we receive a
                  valid notice, the actions available to us are:
                </LP>
                <LUl>
                  <LLi>
                    <strong>Terminate live sessions.</strong> Expire or cancel
                    an in-progress transfer that is sharing the identified
                    material.
                  </LLi>
                  <LLi>
                    <strong>Disable share links.</strong> Deactivate the link
                    and 6-digit code so no further downloads can start, even
                    before natural expiry.
                  </LLi>
                  <LLi>
                    <strong>Block repeat or abusive senders</strong> by network
                    address and device signals, to the extent technically
                    feasible.
                  </LLi>
                  <LLi>
                    <strong>Preserve and disclose records</strong> — the
                    metadata described in our{" "}
                    <a href="/legal/privacy">Privacy Policy</a> — where
                    required by law.
                  </LLi>
                </LUl>
                <LP>
                  What we cannot do is &ldquo;remove&rdquo; files from storage,
                  because there is no storage: once a transfer has completed
                  and expired, the files exist only on the two devices that
                  took part. If you need material removed from a specific
                  recipient&rsquo;s device, that is a matter between you and
                  that person — the DMCA gives service providers no power over
                  end-user devices, and neither do we have any.
                </LP>
              </>
            ),
          },
          {
            id: "filing-a-notice",
            title: "Filing a takedown notice",
            content: (
              <>
                <LP>
                  To be effective under the DMCA, your written notice must be
                  sent to <strong>abuse@ilovedoc.org</strong> with the subject
                  line &ldquo;DMCA&rdquo; and must include all of the
                  following:
                </LP>
                <LUl>
                  <LLi>
                    A physical or electronic signature of the copyright owner,
                    or of a person authorized to act on their behalf;
                  </LLi>
                  <LLi>
                    Identification of the copyrighted work you claim has been
                    infringed (for example, the title and a description or
                    representative excerpt);
                  </LLi>
                  <LLi>
                    Identification of the material you claim is infringing,
                    including enough detail for us to find it — most usefully
                    the <strong>share link or 6-digit code</strong> of the
                    transfer, plus the file name(s) and the date and time you
                    observed it;
                  </LLi>
                  <LLi>
                    Your contact information: full name, mailing address,
                    telephone number, and email address;
                  </LLi>
                  <LLi>
                    A statement that you have a good-faith belief that the
                    identified use is not authorized by the copyright owner,
                    its agent, or the law; and
                  </LLi>
                  <LLi>
                    A statement, made under penalty of perjury, that the
                    information in your notice is accurate and that you are
                    the copyright owner or authorized to act on their behalf.
                  </LLi>
                </LUl>
                <LH3>What happens next</LH3>
                <LP>
                  We review notices as they arrive. For notices that are valid
                  and identify a live or recent transfer, we take the actions
                  listed above and confirm by email where a reply address is
                  available. Because sessions are short-lived by design,
                  material identified in a notice has often already expired on
                  its own — we still act, so that any late downloader is
                  blocked.
                </LP>
              </>
            ),
          },
          {
            id: "counter-notification",
            title: "Counter-notification",
            content: (
              <>
                <LP>
                  If your transfer was disabled because of a takedown notice
                  and you believe the claim was mistaken or misidentified, you
                  may send a counter-notification to{" "}
                  <strong>abuse@ilovedoc.org</strong> including:
                </LP>
                <LUl>
                  <LLi>your physical or electronic signature;</LLi>
                  <LLi>
                    identification of the material that was disabled and where
                    it appeared (share link or code);
                  </LLi>
                  <LLi>
                    a statement under penalty of perjury that you have a
                    good-faith belief the material was disabled as a result of
                    mistake or misidentification;
                  </LLi>
                  <LLi>your name, address, and telephone number; and</LLi>
                  <LLi>
                    your consent to the jurisdiction of a court in the district
                    where you live (or, if outside the United States, where the
                    Service&rsquo;s operator is located), and that you will
                    accept service of process from the person who sent the
                    original notice.
                  </LLi>
                </LUl>
                <LP>
                  If we receive a valid counter-notification, we may restore
                  the disabled material in not less than 10 nor more than 14
                  business days, unless the original complainant notifies us
                  of a court action seeking to restrain the activity — all as
                  provided by 17 U.S.C. § 512(g).
                </LP>
              </>
            ),
          },
          {
            id: "repeat-infringers",
            title: "Repeat infringers",
            content: (
              <LP>
                It is our policy, in appropriate circumstances, to block
                senders we identify as repeat infringers from using the
                Service. Because the Service has no accounts, identification is
                necessarily imperfect — we act on network addresses, device
                signals, and behavior patterns where technically feasible.
              </LP>
            ),
          },
          {
            id: "misrepresentation",
            title: "Misrepresentation warning",
            content: (
              <LP>
                Under 17 U.S.C. § 512(f), any person who knowingly materially
                misrepresents in a notice or counter-notification that material
                is infringing — or was disabled by mistake — may be liable for
                damages, including costs and attorneys&rsquo; fees. Please make
                sure your notice is accurate before sending it.
              </LP>
            ),
          },
          {
            id: "gavel-note",
            title: "This is not legal advice",
            content: (
              <LP>
                This policy describes how we handle copyright complaints. It
                is not legal advice, and it does not create rights beyond
                those the law provides. If you are unsure of your position,
                consult qualified counsel in your jurisdiction.
              </LP>
            ),
          },
        ]}
      />
    </>
  )
}
