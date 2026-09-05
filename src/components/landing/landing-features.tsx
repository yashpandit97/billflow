import {
  BarChart3,
  Palette,
  Package,
  Receipt,
  QrCode,
  Mail,
  Smartphone,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FeatureBlockProps = {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  icon: React.ComponentType<{ className?: string }>;
  visual: React.ReactNode;
  reverse?: boolean;
};

function FeatureBlock({
  id,
  eyebrow,
  title,
  description,
  bullets,
  icon: Icon,
  visual,
  reverse,
}: FeatureBlockProps) {
  return (
    <article
      id={id}
      className={cn(
        "scroll-mt-20 grid items-center gap-8 lg:grid-cols-2 lg:gap-12",
        reverse && "lg:[&>div:first-child]:order-2"
      )}
    >
      <div>
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Icon className="size-4" />
          <span className="text-xs font-semibold tracking-[0.15em] uppercase">
            {eyebrow}
          </span>
        </div>
        <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3>
        <p className="mt-3 text-pretty text-muted-foreground">{description}</p>
        <ul className="mt-5 space-y-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border/80 bg-card/50 p-4 ring-1 ring-foreground/5 sm:p-6">
        {visual}
      </div>
    </article>
  );
}

function BillingVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-secondary/80 px-3 py-2 text-sm text-muted-foreground">
        Search products or add new items…
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {["Masala Chai ₹40", "Samosa ₹25", "Paneer Roll ₹120"].map((p) => (
          <div
            key={p}
            className="rounded-lg border border-border bg-background/60 px-2 py-3 text-center text-xs sm:text-sm"
          >
            {p}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>₹185</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span>- ₹15</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
          <span>Total</span>
          <span className="text-primary">₹170</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {["Cash", "UPI", "Card"].map((m) => (
          <Badge key={m} variant={m === "UPI" ? "default" : "outline"}>
            {m}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function InvoiceVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-lg border border-border bg-background p-4 text-sm shadow-inner">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            AB
          </div>
          <div>
            <p className="font-semibold">ABC Business</p>
            <p className="text-xs text-muted-foreground">GSTIN · Phone · Address</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">#INV-1024</p>
      </div>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2">Item</th>
            <th className="pb-2 text-right">Qty</th>
            <th className="pb-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Masala Chai", "2", "₹80"],
            ["Samosa", "3", "₹75"],
          ].map(([item, qty, total]) => (
            <tr key={item}>
              <td className="py-1">{item}</td>
              <td className="py-1 text-right">{qty}</td>
              <td className="py-1 text-right">{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
        <span>Total</span>
        <span>₹155</span>
      </div>
    </div>
  );
}

function UpiVisual() {
  return (
    <div className="mx-auto max-w-xs text-center">
      <p className="text-sm font-medium">Payment: UPI</p>
      <p className="mt-1 text-xs text-muted-foreground">Scan to Pay</p>
      <div className="mx-auto mt-4 flex size-28 items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-background">
        <QrCode className="size-16 text-primary/80" />
      </div>
      <p className="mt-3 text-sm font-semibold">ABC Business</p>
      <p className="text-xs text-muted-foreground">Your UPI QR · your payment</p>
    </div>
  );
}

function EmailVisual() {
  const steps = [
    "Create bill",
    "Generate invoice",
    "Tap Send bill",
    "Add customer email if needed",
    "Email the PDF",
  ];
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-stretch">
      <ol className="flex flex-1 flex-col justify-center space-y-2 text-sm">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="w-full max-w-[140px] rounded-2xl border border-border bg-[#0a1014] p-3 sm:w-auto">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-primary">
          <Mail className="size-3.5" />
          Email
        </div>
        <div className="space-y-1.5">
          <div className="rounded-lg rounded-tl-none bg-[#1f2c34] px-2 py-1.5 text-[9px]">
            Invoice #1024 · ₹2,450
          </div>
          <div className="rounded-lg rounded-tl-none bg-[#1f2c34] px-2 py-1.5 text-[9px] text-muted-foreground">
            PDF attached
          </div>
        </div>
        <p className="mt-2 text-[8px] text-muted-foreground">Sent to customer</p>
      </div>
    </div>
  );
}

function MobileVisual() {
  return (
    <div className="mx-auto w-full max-w-[220px] rounded-[1.75rem] border-4 border-border bg-background p-3 shadow-xl">
      <div className="mb-2 h-1 w-10 mx-auto rounded-full bg-border" />
      <p className="text-xs font-semibold">Billing</p>
      <div className="mt-2 rounded-md bg-secondary/80 px-2 py-1.5 text-[10px] text-muted-foreground">
        Fast product search
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {["Item A", "Item B", "Item C", "Item D"].map((item) => (
          <div
            key={item}
            className="rounded-md border border-border/60 py-3 text-center text-[10px]"
          >
            {item}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-md bg-primary py-2 text-center text-[10px] font-medium text-primary-foreground">
        Generate Invoice
      </div>
    </div>
  );
}

function ReportsVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        ["Today's Sales", "₹24,850"],
        ["This Month", "₹4,82,300"],
        ["Bills Generated", "1,248"],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg bg-secondary/80 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
        </div>
      ))}
      <div className="rounded-lg border border-border bg-background/40 p-3 sm:col-span-2">
        <p className="text-xs font-medium text-muted-foreground">Top Products</p>
        <ul className="mt-2 space-y-1 text-sm">
          {["Masala Chai", "Samosa", "Paneer Roll"].map((p, i) => (
            <li key={p} className="flex justify-between">
              <span>{p}</span>
              <span className="text-muted-foreground">{90 - i * 12}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProductsVisual() {
  return (
    <div className="space-y-2">
      {[
        { name: "Masala Chai", price: "₹40", sku: "TEA-01" },
        { name: "Samosa", price: "₹25", sku: "SNK-02" },
        { name: "Paneer Roll", price: "₹120", sku: "ML-15" },
      ].map((p) => (
        <div
          key={p.sku}
          className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2.5 text-sm"
        >
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.sku}</p>
          </div>
          <p className="font-semibold tabular-nums">{p.price}</p>
        </div>
      ))}
    </div>
  );
}

function BrandingVisual() {
  return (
    <div className="space-y-3 text-sm">
      {["Business name", "Logo upload", "Contact & address", "UPI QR", "Invoice colors"].map(
        (field) => (
          <div key={field} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
            <span>{field}</span>
            <Badge variant="outline" className="text-[10px]">
              Configured
            </Badge>
          </div>
        )
      )}
      <p className="text-center text-xs text-muted-foreground">
        Every invoice looks like your business — not ours.
      </p>
    </div>
  );
}

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6 sm:space-y-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Billing tools that work the way you do
          </h2>
          <p className="mt-4 text-muted-foreground">
            From creating a bill to getting paid — everything is designed to be
            fast, clear, and mobile-friendly.
          </p>
        </div>

        <FeatureBlock
          eyebrow="Fast billing"
          title="Create a bill in seconds."
          description="Search your products, adjust quantities, apply a discount, choose how the customer paid, and generate the invoice — all from one screen."
          bullets={[
            "Search products by name or SKU",
            "Adjust quantities with large touch-friendly controls",
            "Apply bill-level discounts",
            "Select Cash, UPI, Card, and more",
            "Complete the invoice in one tap",
          ]}
          icon={Zap}
          visual={<BillingVisual />}
        />

        <FeatureBlock
          eyebrow="Professional invoices"
          title="Invoices that represent your business."
          description="Give every customer a clean, professional invoice with your branding, product details, taxes, and payment information."
          bullets={[
            "Your logo and business details",
            "Invoice number and line items",
            "Taxes and discounts where configured",
            "Payment method and status",
            "Print-ready A4 or thermal formats",
          ]}
          icon={Receipt}
          visual={<InvoiceVisual />}
          reverse
        />

        <FeatureBlock
          eyebrow="UPI payments"
          title="Get paid with UPI."
          description="Upload your own UPI QR code. When UPI is the payment method, the invoice shows your QR so customers can pay you directly."
          bullets={[
            "Configure your UPI ID in settings",
            "Upload your bank or GPay QR",
            "QR appears on UPI invoices automatically",
            "BillMoney does not process payments for you",
          ]}
          icon={QrCode}
          visual={<UpiVisual />}
        />

        <FeatureBlock
          eyebrow="Email invoices"
          title="Send the bill by email."
          description="After creating an invoice, tap Send bill to customer. If you haven’t captured their details yet, add a name and email, then send the PDF."
          bullets={[
            "Email the invoice PDF to your customer",
            "Add customer details at send time if needed",
            "Download or print as a fallback",
            "You stay in control of every send",
          ]}
          icon={Mail}
          visual={<EmailVisual />}
          reverse
        />

        <FeatureBlock
          eyebrow="Mobile billing"
          title="Your phone is your billing counter."
          description="No computer? No problem. BillMoney works beautifully on phones and tablets — designed for shop counters, delivery counters, and on-the-go billing."
          bullets={[
            "Fast product search on mobile",
            "Large touch-friendly controls",
            "Generate and share invoices from your phone",
            "View sales reports anywhere",
          ]}
          icon={Smartphone}
          visual={<MobileVisual />}
        />

        <FeatureBlock
          eyebrow="Reports"
          title="Know how your business is doing."
          description="See today's sales, monthly totals, bill counts, and top products — simple reports that help you understand your business without enterprise complexity."
          bullets={[
            "Today's and monthly sales",
            "Bill counts and averages",
            "Top-selling products",
            "Sales by payment method",
          ]}
          icon={BarChart3}
          visual={<ReportsVisual />}
          reverse
        />

        <FeatureBlock
          eyebrow="Products"
          title="Keep your products organized."
          description="Add products once, set prices, and find them instantly when billing. Update prices anytime without digging through spreadsheets."
          bullets={[
            "Add and edit products with prices",
            "Search and filter your catalog",
            "Categories and SKU support",
            "Quick-add products while billing",
          ]}
          icon={Package}
          visual={<ProductsVisual />}
        />

        <FeatureBlock
          eyebrow="Branding"
          title="Make every invoice yours."
          description="Configure your business name, logo, contact details, address, UPI QR, and invoice styling. Customers see your brand — not a generic template."
          bullets={[
            "Upload your logo and brand colors",
            "Set invoice prefix and footer",
            "Add payment instructions",
            "Optional restaurant tabs and guest QR menus",
          ]}
          icon={Palette}
          visual={<BrandingVisual />}
          reverse
        />
      </div>
    </section>
  );
}
