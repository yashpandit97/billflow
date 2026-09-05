import {
  SUBSCRIPTION_AMOUNT_MAJOR,
  TRIAL_DAYS,
  formatSubscriptionPrice,
} from "@/lib/subscription/constants";

export const LANDING_PRICE = formatSubscriptionPrice();
export const LANDING_PRICE_AMOUNT = SUBSCRIPTION_AMOUNT_MAJOR;
export const LANDING_TRIAL_DAYS = TRIAL_DAYS;

export const LANDING_NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#why-us", label: "Why Us" },
] as const;

export const LANDING_TRUST_ITEMS = [
  `${LANDING_TRIAL_DAYS}-day free trial`,
  `${LANDING_PRICE}/month`,
  "No transaction fees",
  "Mobile friendly",
  "UPI ready",
  "Email invoices",
] as const;

export const LANDING_PRICING_FEATURES = [
  "Unlimited billing",
  "Product management",
  "Professional invoices",
  "UPI QR invoices",
  "Email invoices",
  "Reports",
  "Business branding",
  "Mobile access",
  "No transaction fees",
] as const;

export const LANDING_FAQ = [
  {
    question: "Is the first month really free?",
    answer: `Yes. New businesses get ${LANDING_TRIAL_DAYS} days to try BillMoney before the ${LANDING_PRICE}/month subscription begins.`,
  },
  {
    question: "How much does it cost?",
    answer: `${LANDING_PRICE}/month. One plan. Everything included.`,
  },
  {
    question: "Are there transaction fees?",
    answer:
      "No. BillMoney does not take a percentage of your sales. You pay a flat monthly subscription.",
  },
  {
    question: "Can I use it on my phone?",
    answer:
      "Yes. BillMoney is designed to work on phones, tablets, and computers.",
  },
  {
    question: "Do I need a printer?",
    answer:
      "No. You can download, print, or share invoices digitally from your device.",
  },
  {
    question: "Can I email invoices to customers?",
    answer:
      "Yes. After you create an invoice, tap Send bill to customer and email the PDF. If the customer isn’t on the bill yet, add their details first.",
  },
  {
    question: "Can I add my own UPI QR code?",
    answer:
      "Yes. Upload your business UPI QR in settings. When UPI is selected, the invoice shows your QR for customers to scan.",
  },
  {
    question: "Can I refer other businesses?",
    answer:
      "Yes. Share your referral link. When a referred business becomes a paying customer, you earn one free month.",
  },
  {
    question: "Can multiple people use the same business account?",
    answer:
      "Your subscription covers the whole business. Owner, admin, and staff roles are supported in the product. Team invites from the app are coming soon.",
  },
] as const;

export const LANDING_COMPARE_ROWS = [
  { feature: "Mobile-first billing", us: true, them: "Often limited" },
  { feature: "Simple billing workflow", us: true, them: true },
  { feature: "Email invoices", us: true, them: "Varies" },
  { feature: "UPI QR on invoices", us: true, them: "Varies" },
  { feature: "Simple flat pricing", us: true, them: "Often complicated" },
  { feature: "No transaction fees", us: true, them: "Varies" },
  { feature: "Easy setup", us: true, them: "Often complicated" },
] as const;
