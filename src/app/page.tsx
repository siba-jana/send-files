import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { TransferWidget } from "@/components/transfer/transfer-widget";
import { StatsStrip } from "@/components/site/stats-strip";
import { HowItWorks } from "@/components/site/how-it-works";
import { SecuritySection } from "@/components/site/security-section";
import { Faq } from "@/components/site/faq";
import { Footer } from "@/components/site/footer";

/**
 * Transfer links (`/?t=<token>`) and code entries (`/?code=<digits>`) are
 * private, ephemeral pages — keep them out of search engines entirely.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const isPrivateTransfer = Boolean(params.t || params.code);
  if (isPrivateTransfer) {
    return {
      robots: {
        index: false,
        follow: false,
        noarchive: true,
        nocache: true,
      },
    };
  }
  return {};
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TransferWidget />
        <StatsStrip />
        <HowItWorks />
        <SecuritySection />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
