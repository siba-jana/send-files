"use client";

import { useEffect } from "react";

/**
 * Removes #transfer from the address bar if present so the URL stays
 * clean as a dedicated tool page without unnecessary anchor hash.
 */
export function CleanHash() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#transfer") {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, []);

  return null;
}

