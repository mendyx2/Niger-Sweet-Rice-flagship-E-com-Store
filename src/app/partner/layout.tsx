import type { Metadata } from "next";

export const metadata: Metadata = { title: "Partner portal", robots: { index: false, follow: false } };

export default function PartnerLayout({ children }: LayoutProps<"/partner">) {
  return <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>;
}
