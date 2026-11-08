import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : "https://www.ilovedoc.org");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "ilovedoc.org — Send Files Directly From Browser to Browser",
    template: "%s · ilovedoc.org",
  },
  description:
    "Fast peer-to-peer file sharing with encrypted WebRTC connections and automatic relay fallback when needed. No permanent cloud storage, no sign-up — just connect and transfer.",
  keywords: [
    "file transfer",
    "peer to peer file sharing",
    "send files online",
    "large file transfer",
    "browser to browser transfer",
    "P2P file transfer",
    "direct file sharing",
    "no cloud storage",
  ],
  authors: [{ name: "I Love Doc" }],
  applicationName: "I Love Doc",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "ilovedoc.org — Send Files Directly From Browser to Browser",
    description:
      "Files transfer directly between browsers over encrypted WebRTC. No permanent cloud storage. No complicated setup.",
    url: SITE_URL,
    siteName: "I Love Doc",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1216,
        height: 640,
        alt: "I Love Doc — files flying between two browsers over a direct encrypted connection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ilovedoc.org — Send Files Directly From Browser to Browser",
    description:
      "Fast peer-to-peer file sharing with encrypted WebRTC connections and automatic relay fallback when needed.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/**
 * Apply the persisted theme before first paint to avoid a flash of the wrong
 * scheme (mirrors the header toggle: `.dark` class + localStorage "theme").
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

/**
 * Apply the persisted or detected locale and direction before first paint.
 */
const localeBootstrap = `(function(){try{var s=["en","es","fr","de","zh","ja","hi","pt","ar","ru"];var p=window.location.pathname.split("/")[1];var l=(p&&s.indexOf(p)!==-1)?p:null;if(!l){l=localStorage.getItem("ilovedoc_locale");}if(!l){var m=document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/);if(m&&s.indexOf(m[1])!==-1)l=m[1];}if(!l&&navigator.language){var c=navigator.language.slice(0,2).toLowerCase();if(s.indexOf(c)!==-1)l=c;}if(l){document.documentElement.lang=l;document.documentElement.dir=(l==="ar")?"rtl":"ltr";}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
        <Script
          id="locale-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: localeBootstrap }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
