import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menu",
  robots: { index: false, follow: false },
};

export default function PublicMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
