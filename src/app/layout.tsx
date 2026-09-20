import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

const heading = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const sans = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Split the Wine",
  description:
    "Photograph the check, send a link, claim what you actually ordered. Tax and tip follow the drinks.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8f1d32",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
