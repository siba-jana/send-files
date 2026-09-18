"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { Download, Send } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeCode } from "@/hooks/use-receive";
import { ReceivePanel, type ReceiveControllerApi } from "./receive-panel";
import { SendPanel } from "./send-panel";

type TransferMode = "send" | "receive";

const TOKEN_PATTERN = /^[A-Za-z0-9]{6,32}$/;

/** Track the manual `.dark` class on <html> as an external store. */
function subscribeToDarkClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getDarkSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

export interface TransferWidgetProps {
  className?: string;
}

/**
 * Orchestrates the Send/Receive tabs. Both panels stay mounted at all times
 * (Radix `forceMount` + CSS `hidden`) so an in-flight transfer survives tab
 * switches. Also:
 *  - listens for the `ilovedoc:mode` CustomEvent (hero CTAs, header CTA),
 *  - on mount, consumes `?t=<token>` / `?code=<6 digits>` share params,
 *  - mounts the sonner `<Toaster />` used by both panels.
 */
export function TransferWidget({ className }: TransferWidgetProps) {
  const [mode, setMode] = useState<TransferMode>("send");
  const receiveApiRef = useRef<ReceiveControllerApi | null>(null);
  const didInitRef = useRef(false);

  const registerReceiveController = useCallback(
    (api: ReceiveControllerApi) => {
      receiveApiRef.current = api;
    },
    [],
  );

  // Sonner theme follows the manual `.dark` class toggle used by the header.
  const isDark = useSyncExternalStore(
    subscribeToDarkClass,
    getDarkSnapshot,
    () => false,
  );

  // Hero/header CTAs dispatch 'ilovedoc:mode' before scrolling here.
  useEffect(() => {
    const onMode = (event: Event) => {
      const detail = (event as CustomEvent<TransferMode>).detail;
      if (detail === "send" || detail === "receive") setMode(detail);
    };
    window.addEventListener("ilovedoc:mode", onMode);
    return () => window.removeEventListener("ilovedoc:mode", onMode);
  }, []);

  // Share-link entry: `/?t=<token>` or `/?code=<6 digits>` → receive flow.
  // The tab switch reuses the public 'ilovedoc:mode' channel (same path as
  // the hero/header CTAs), keeping a single mode-switching code path.
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("t")?.trim() ?? "";
      const code = normalizeCode(params.get("code") ?? "");
      if (TOKEN_PATTERN.test(token)) {
        receiveApiRef.current?.startByToken(token);
        scrollToWidget();
        enterReceiveMode();
      } else if (code.length === 6) {
        receiveApiRef.current?.startByCode(code);
        scrollToWidget();
        enterReceiveMode();
      }
    } catch {
      // Malformed query string — ignore.
    }
  }, []);

  return (
    <section
      id="transfer"
      aria-labelledby="transfer-heading"
      className={`scroll-mt-24 py-12 sm:py-16 ${className ?? ""}`}
    >
      <Toaster richColors position="top-center" theme={isDark ? "dark" : "light"} />
      <p aria-live="polite" className="sr-only">
        {mode === "send"
          ? "Send files mode selected."
          : "Receive files mode selected."}
      </p>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2
            id="transfer-heading"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Start a transfer
          </h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
            Send files straight to another browser — or enter a code to receive
            yours.
          </p>
        </div>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value === "receive" ? "receive" : "send")}
          className="gap-6"
        >
          {/* Sliding active-tab thumb: glides between the two triggers
              (transform-only animation — cheap, and disabled under
              prefers-reduced-motion). Triggers sit above it (z-10) and keep
              their own backgrounds transparent when active so the thumb
              provides the "active pill". */}
          <TabsList className="relative grid h-13 w-full grid-cols-2 rounded-xl">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%_-_0.25rem)] rounded-lg bg-background shadow-sm ring-1 ring-black/[0.04] transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-input/30 dark:ring-white/[0.06] dark:shadow-none ${
                mode === "receive"
                  ? "translate-x-[calc(50%_-_0.25rem)]"
                  : "translate-x-0"
              }`}
            />
            <TabsTrigger
              value="send"
              className="relative z-10 min-h-11 rounded-lg text-sm font-medium sm:text-base data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent [&[data-state=active]_svg]:text-rose-600 dark:[&[data-state=active]_svg]:text-rose-400"
            >
              <Send aria-hidden="true" />
              Send Files
            </TabsTrigger>
            <TabsTrigger
              value="receive"
              className="relative z-10 min-h-11 rounded-lg text-sm font-medium sm:text-base data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-transparent [&[data-state=active]_svg]:text-rose-600 dark:[&[data-state=active]_svg]:text-rose-400"
            >
              <Download aria-hidden="true" />
              Receive Files
            </TabsTrigger>
          </TabsList>

          {/* forceMount keeps both engines alive across tab switches; the
              inactive content is hidden via the HTML hidden attribute. */}
          <TabsContent value="send" forceMount className="data-[state=inactive]:hidden">
            <SendPanel />
          </TabsContent>
          <TabsContent value="receive" forceMount className="data-[state=inactive]:hidden">
            <ReceivePanel registerController={registerReceiveController} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function enterReceiveMode() {
  window.dispatchEvent(
    new CustomEvent<TransferMode>("ilovedoc:mode", { detail: "receive" }),
  );
}

function scrollToWidget() {
  window.setTimeout(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById("transfer")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, 60);
}
