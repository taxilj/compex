import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const DEFAULT_TITLE = "Electronic Component Sourcing in India | Compex Solution";
const DEFAULT_DESCRIPTION =
  "B2B electronic component sourcing for Indian manufacturers. Search exact part numbers, submit BOMs, and request sourcing support from Compex Solution.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
    images: ["/compex-logo.jpeg"],
  },
  twitter: { card: "summary", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: ["/compex-logo.jpeg"] },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
