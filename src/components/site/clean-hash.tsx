"use client";

import { useEffect } from "react";

/**
 * Removes #transfer or #top from the address bar if present so the URL stays
 * clean as a dedicated tool page without unnecessary anchor hashes.
 */
export function CleanHash() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      window.location.hash === "#transfer" ||
      window.location.hash === "#top" ||
      window.location.hash === "#how-it-works" ||
      window.location.hash === "#security" ||
      window.location.hash === "#faq"
    ) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, []);

  return null;
}

