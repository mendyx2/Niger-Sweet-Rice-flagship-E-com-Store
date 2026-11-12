import { NextResponse, type NextRequest } from "next/server";

/** Referral link: /r/AMINA2X7K → remembers the referrer for 30 days, then goes to the shop. */
export async function GET(req: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const res = NextResponse.redirect(new URL("/shop", req.url));
  if (/^[A-Z0-9]{4,12}$/i.test(code)) {
    res.cookies.set("nsr_ref", code.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 86400,
      path: "/",
    });
  }
  return res;
}
