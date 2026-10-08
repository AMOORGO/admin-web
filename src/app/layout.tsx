import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmoorGo — Super Admin Console | Operations & Fleet Command",
  description:
    "Next-generation ride hailing operations, real-time dispatch, fleet safety, Second Chance program, and financial ledger management console.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen font-sans selection:bg-[#3A102F] selection:text-white"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
