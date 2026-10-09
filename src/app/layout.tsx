import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AmoorGo — Super Admin Console | Operations & Fleet Command",
  description:
    "Next-generation ride hailing operations, real-time dispatch, fleet safety, Second Chance program, and financial ledger management console.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Paint under the notch / home indicator; the shell and sheets pad with env(safe-area-inset-*).
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0811" },
  ],
};

/** Runs before first paint so a stored dark theme never flashes light (mirrors applyTheme in lib/theme.ts). */
const THEME_BOOT = `try{var t=localStorage.getItem("amoorgo-theme")==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.toggle("dark",t==="dark");var c=t==="dark"?"#0F0811":"#FDFBFC";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Loaded from Google Fonts at runtime (not next/font) so builds keep working offline. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-dvh font-sans selection:bg-[#3A102F] selection:text-white"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
