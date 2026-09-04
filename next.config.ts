import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prefer the Node build of react-pdf on the server (Cloudflare Workers / OpenNext).
  // Do not use turbopack.resolveAlias with absolute filesystem paths — Turbopack
  // treats them as relative and breaks local `next dev`.
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/pdfkit",
    "@react-pdf/layout",
    "@react-pdf/image",
    "@react-pdf/png-js",
    "fontkit",
    "jpeg-exif",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
