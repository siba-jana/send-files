"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

// Suppress React 19 / Next.js development warning overlay for inline scripts
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

/**
 * Apply the persisted theme before first paint to avoid a flash of the wrong
 * scheme (mirrors the header toggle: `.dark` class + localStorage "theme").
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

/**
 * Apply the persisted or detected locale and direction before first paint.
 */
const localeBootstrap = `(function(){try{var s=["en","es","fr","de","zh","ja","hi","pt","ar","ru"];var p=window.location.pathname.split("/")[1];var l=(p&&s.indexOf(p)!==-1)?p:null;if(!l){l=localStorage.getItem("ilovedoc_locale");}if(!l){var m=document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/);if(m&&s.indexOf(m[1])!==-1)l=m[1];}if(!l&&navigator.language){var c=navigator.language.slice(0,2).toLowerCase();if(s.indexOf(c)!==-1)l=c;}if(l){document.documentElement.lang=l;document.documentElement.dir=(l==="ar")?"rtl":"ltr";}}catch(e){}})();`;

/**
 * Injects pre-paint bootstrap scripts directly into the server HTML stream via Next.js's
 * `useServerInsertedHTML` hook. Because this component returns `null` in its JSX on the client,
 * React 19 never encounters a script tag during client rendering/hydration.
 */
export function BootstrapScript() {
  const isInserted = useRef(false);

  useServerInsertedHTML(() => {
    if (isInserted.current) return null;
    isInserted.current = true;

    return (
      <>
        <script
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
        <script
          id="locale-bootstrap"
          dangerouslySetInnerHTML={{ __html: localeBootstrap }}
        />
      </>
    );
  });

  return null;
}
