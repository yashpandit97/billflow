import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Billflow — Simple billing for your business";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "#0b0d0f",
          color: "#f5f5f5",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "#d4af37",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b0d0f",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            B
          </div>
          <span style={{ fontSize: "40px", fontWeight: 700 }}>Billflow</span>
        </div>
        <div
          style={{
            fontSize: "56px",
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: "900px",
          }}
        >
          Simple billing for your business
        </div>
        <div
          style={{
            marginTop: "24px",
            fontSize: "28px",
            color: "#a7adb5",
            maxWidth: "800px",
          }}
        >
          Invoices · UPI · WhatsApp · ₹299/month · No transaction fees
        </div>
      </div>
    ),
    { ...size }
  );
}
