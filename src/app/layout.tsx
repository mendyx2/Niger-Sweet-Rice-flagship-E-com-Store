import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Analytics, ConsentBanner } from "@/components/consent";
import { site } from "@/lib/site";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Buy Rice Online in Abuja: 50kg, 25kg, 5kg & 1kg`,
    template: `%s | ${site.name} Abuja`,
  },
  description:
    `Order ${site.name} online from our Abuja flagship store. 50kg, 25kg, 5kg and 1kg bags, delivered across Abuja and nearby towns, or pick up in store.`,
  openGraph: { type: "website", locale: "en_NG", siteName: site.name },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#1d4d2d" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-surface">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
        <ConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
