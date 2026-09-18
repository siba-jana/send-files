"use client";

import { FileQuestion, Home, ArrowLeft } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

/**
 * Branded 404 (Next.js convention file). Unknown paths keep the site chrome
 * so visitors can navigate back; transfer links are query-based (`/?t=…`),
 * so an old-fashioned path here is genuinely an unknown route.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
            <FileQuestion aria-hidden="true" className="size-7" />
          </span>
          <p className="mt-6 font-mono text-sm font-medium tracking-widest text-rose-600 dark:text-rose-400">
            404
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            This page doesn&apos;t exist
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The link may be mistyped or outdated. Transfers live on the
            homepage — and remember, share links look like{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              ilovedoc.org/?t=…
            </code>
            .
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-medium text-white shadow-lg shadow-rose-600/25 transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-rose-500 dark:hover:bg-rose-600 sm:w-auto"
            >
              <Home aria-hidden="true" className="size-4" />
              Back to homepage
            </a>
            <button
              type="button"
              onClick={() => history.back()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border bg-card px-6 text-sm font-medium shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Go back
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
