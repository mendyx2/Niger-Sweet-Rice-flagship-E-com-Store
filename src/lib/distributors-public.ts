import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import QRCode from "qrcode";
import { db } from "./db";
import { TAGS } from "./catalogue";
import { site } from "./site";

/** Distributors shown publicly: active, with at least one area. */
export async function getPublicDistributors() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.zones);
  const list = await db.distributor.findMany({
    where: { isHq: false, status: "ACTIVE", zones: { some: {} } },
    orderBy: { name: "asc" },
    include: { zones: { orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } } },
  });
  return list.map((d) => ({ id: d.id, slug: d.slug, name: d.name, address: d.address, hours: d.hours, phone: d.phone, zones: d.zones }));
}

export const shopLink = (slug: string) => `${site.url}/distributors/${slug}`;

/** Printable QR code (SVG) for a distributor's shop link, e.g. for their counter or delivery van. */
export async function shopQrSvg(slug: string): Promise<string> {
  return QRCode.toString(shopLink(slug), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#133821", light: "#ffffff" } });
}
