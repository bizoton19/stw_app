import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://api.splitthewine.app"),
  title: {
    default: "Split the Wine",
    template: "%s · Split the Wine",
  },
  description:
    "Photograph the check, send a link, claim what you actually ordered.",
  applicationName: "Split the Wine",
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/brand/favicon-32.png"],
  },
  openGraph: {
    type: "website",
    siteName: "Split the Wine",
    title: "Split the Wine",
    description:
      "Photograph the check, send a link, claim what you actually ordered.",
    images: [
      {
        url: "/brand/og.png",
        width: 1200,
        height: 1200,
        alt: "Split the Wine",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Split the Wine",
    description:
      "Photograph the check, send a link, claim what you actually ordered.",
    images: ["/brand/og.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Split the Wine",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#f6f4f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
