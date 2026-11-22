export interface FaqItemData {
  q: string;
  a: string;
}

/**
 * File Transfer specific FAQs (used on /files-transfer-online).
 */
export const FAQS: readonly FaqItemData[] = [
  {
    q: "Is this really peer-to-peer?",
    a: "Yes. Whenever your network allows it, the two browsers connect directly over WebRTC and files stream straight from device to device — they never touch our servers. The connection badge shows “Direct P2P” so you can always confirm.",
  },
  {
    q: "What happens when a direct connection isn’t possible?",
    a: "Some networks — corporate firewalls, symmetric NAT, certain mobile carriers — block direct links. The transfer then falls back to an encrypted relay, and the connection badge clearly shows “Secure relay” so you always know which path your files take.",
  },
  {
    q: "Do you store my files?",
    a: "No. There is no permanent cloud storage. Files stream directly between browsers, and the server keeps only temporary session metadata needed to coordinate the handshake — deleted once the transfer expires.",
  },
  {
    q: "How large can my files be?",
    a: "I Love Doc is built for large transfers: files are streamed in small chunks, so multi-gigabyte transfers work without loading everything into memory. The practical limit comes down to the browsers and devices involved.",
  },
  {
    q: "Is it secure?",
    a: "Every transfer runs over WebRTC’s built-in DTLS encryption. You can additionally protect a transfer with a password, share links expire automatically, and every file is verified with SHA-256 before delivery is confirmed.",
  },
  {
    q: "Do I need an account?",
    a: "No. Open the site, select your files, and share the code. No sign-up, no email address, no profile.",
  },
  {
    q: "Which browsers are supported?",
    a: "All modern browsers: Chrome, Edge, Firefox, and Safari, on both desktop and mobile.",
  },
  {
    q: "How long does a transfer stay available?",
    a: "As long as the sender keeps the tab open, and until the transfer expires. You choose the lifetime when creating it — from 1 hour to 7 days, with 24 hours as the default.",
  },
  {
    q: "What if the connection drops mid-transfer?",
    a: "The transfer automatically tries to reconnect and resumes from the last confirmed chunk, so a dropped connection doesn’t mean starting over.",
  },
  {
    q: "Can I password-protect a transfer?",
    a: "Yes. When you create a transfer you can set a password, and the recipient must enter it before any file metadata or data is released.",
  },
] as const;

/**
 * Platform & Document Suite FAQs (used on the Homepage Hub /).
 */
export const HUB_FAQS: readonly FaqItemData[] = [
  {
    q: "What is I Love Doc?",
    a: "I Love Doc is a suite of free, privacy-first web utilities for documents and files. We offer direct peer-to-peer large file sharing, ChatGPT conversation-to-PDF conversion, and more browser-native productivity tools designed with zero permanent cloud storage.",
  },
  {
    q: "Are all tools on I Love Doc completely free?",
    a: "Yes, 100% free. There are no paywalls, premium tiers, or hidden subscriptions. You get unlimited access to send files and convert documents directly in your browser.",
  },
  {
    q: "Do I need to create an account or sign in?",
    a: "No. We believe in total friction-free utility and privacy. You never need an account, email address, phone number, or profile to use any tool on ilovedoc.org.",
  },
  {
    q: "How does I Love Doc protect my privacy and files?",
    a: "Unlike traditional web services that upload your files to centralized cloud servers, I Love Doc operates on a privacy-first model: files transferred with our P2P tool stream directly between devices over encrypted WebRTC, and documents converted with our ChatGPT to PDF tool are processed 100% locally in your browser. Your confidential data never lingers on our servers.",
  },
  {
    q: "Which tools are currently available on I Love Doc?",
    a: "Currently, I Love Doc offers 'Send Big Files Online' (unlimited-size peer-to-peer file transfer) and 'ChatGPT to PDF Converter' (instant formatting and high-DPI PDF generation for AI conversations, code, and math). Additional document tools are continuously being developed.",
  },
  {
    q: "Are there any limits on file size or usage?",
    a: "No artificial limits. Because transfers are peer-to-peer, you can send files of any size directly from your browser. You can also convert as many documents as you need without daily quotas.",
  },
  {
    q: "Which devices and browsers work with I Love Doc?",
    a: "I Love Doc works seamlessly on any modern web browser — including Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge, and Opera — across Windows, macOS, Linux, iOS, and Android.",
  },
  {
    q: "Are my transferred files or converted PDFs saved anywhere?",
    a: "No. We have a strict zero-storage philosophy. Converted PDFs exist only in your browser's temporary memory, and file transfers stream ephemeral bytes directly from sender to recipient.",
  },
] as const;
