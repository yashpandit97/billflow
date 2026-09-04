import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import {
  LANDING_PRICE,
  LANDING_TRIAL_DAYS,
} from "@/lib/landing/constants";

export const metadata: Metadata = {
  title: "Simple Billing Software for Small Business in India",
  description: `Create bills, professional invoices, UPI QR payments, and WhatsApp sharing for Indian small businesses. ${LANDING_TRIAL_DAYS}-day free trial, then ${LANDING_PRICE}/month. No transaction fees.`,
  openGraph: {
    title: "BillMoney — Simple billing for your business",
    description: `Billing and invoicing for Indian SMBs. ${LANDING_TRIAL_DAYS}-day free trial. ${LANDING_PRICE}/month. No transaction fees.`,
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "BillMoney — Simple billing for your business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BillMoney — Simple billing for your business",
    description: `Billing and invoicing for Indian SMBs. ${LANDING_TRIAL_DAYS}-day free trial.`,
    images: ["/og.svg"],
  },
  keywords: [
    "billing software for small business",
    "billing software India",
    "invoice software India",
    "mobile billing software",
    "small business invoice software",
    "UPI invoice software",
    "WhatsApp invoice software",
  ],
};

export default function HomePage() {
  return <LandingPage />;
}
