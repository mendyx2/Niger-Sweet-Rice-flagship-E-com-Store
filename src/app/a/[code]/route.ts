import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashIp } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Affiliate link: /a/CODE (shop) or /a/CODE?p=niger-sweet-rice&size=25 (a product).
 * Remembers the affiliate for 30 days (last click wins) and counts the click.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/a/[code]">) {
  const { code } = await ctx.params;
  const slug = req.nextUrl.searchParams.get("p");
  const size = req.nextUrl.searchParams.get("size");
  const dest = slug && /^[a-z0-9-]{1,80}$/.test(slug)
    ? `/p/${slug}${size && /^\d{1,3}$/.test(size) ? `?size=${size}` : ""}`
    : "/shop";
  const res = NextResponse.redirect(new URL(dest, req.url));

  const normalized = code.toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(normalized)) return res;
  const affiliate = await db.affiliateProfile.findUnique({ where: { code: normalized } });
  if (affiliate?.status !== "APPROVED") return res;

  res.cookies.set("nsr_aff", normalized, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 86400, path: "/",
  });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if ((await rateLimit(`aff-click:${ip}:${normalized}`, 5, 60 * 60_000)).ok) {
    await db.affiliateClick
      .create({ data: { affiliateId: affiliate.userId, ipHash: hashIp(ip), userAgent: req.headers.get("user-agent")?.slice(0, 200), landingUrl: dest } })
      .catch(() => {});
  }
  return res;
}
