import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ilovedoc.org"),
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
    url: "https://ilovedoc.org",
    siteName: "I Love Doc",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ilovedoc.org — Send Files Directly From Browser to Browser",
    description:
      "Fast peer-to-peer file sharing with encrypted WebRTC connections and automatic relay fallback when needed.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
