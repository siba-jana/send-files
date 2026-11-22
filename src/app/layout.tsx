import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/context";
import { BootstrapScript } from "@/components/site/bootstrap-script";

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
    default: "ilovedoc.org — Send Big Files Online Free",
    template: "%s · ilovedoc.org",
  },
  description:
    "Send big files online for free with fast, secure file sharing. Transfer large files without signing up, installing software, or dealing with complicated steps.",
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
    title: "ilovedoc.org — Send Big Files Online Free",
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
    title: "ilovedoc.org — Send Big Files Online Free",
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
        <BootstrapScript />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
