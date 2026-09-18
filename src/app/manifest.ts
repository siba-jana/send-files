import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes ilovedoc.org installable as a standalone app.
 * Icons are the brand rose doc + heart (PNG for install prompts, SVG as a
 * lightweight fallback). No service worker: the app is fully online-only
 * by design (transfers need a live connection anyway).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "I Love Doc — Send Files Browser to Browser",
    short_name: "I Love Doc",
    description:
      "Fast peer-to-peer file sharing with encrypted WebRTC connections, direct from browser to browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e11d48",
    orientation: "portrait-primary",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
