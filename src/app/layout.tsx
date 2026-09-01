import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Billflow — Simple billing for your business",
    template: "%s · Billflow",
  },
  description:
    "Simple billing and invoicing for Indian small businesses. Create bills, share on WhatsApp, accept UPI payments. ₹299/month. No transaction fees.",
  openGraph: {
    siteName: "Billflow",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Billflow — Simple billing for your business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.svg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
