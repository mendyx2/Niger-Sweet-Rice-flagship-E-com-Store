import type { MetadataRoute } from "next";
import { getProducts, getZones } from "@/lib/catalogue";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, zones] = await Promise.all([getProducts(), getZones()]);
  const staticPages = ["", "/shop", "/promotions", "/delivery", "/samples", "/faq", "/track", "/returns-policy", "/privacy", "/terms"].map((path) => ({
    url: `${site.url}${path}`,
  }));
  return [
    ...staticPages,
    ...products.map((p) => ({ url: `${site.url}/p/${p.slug}`, lastModified: p.updatedAt })),
    ...zones.filter((z) => z.kind !== "PICKUP").map((z) => ({ url: `${site.url}/delivery/${z.slug}` })),
  ];
}
