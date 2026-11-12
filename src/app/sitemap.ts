import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const staticPages = ["", "/shop", "/promotions", "/delivery", "/returns-policy"].map((path) => ({
    url: `${site.url}${path}`,
  }));
  return [
    ...staticPages,
    ...products.map((p) => ({ url: `${site.url}/p/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
