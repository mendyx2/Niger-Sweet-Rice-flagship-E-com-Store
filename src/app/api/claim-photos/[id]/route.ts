import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOpsSession } from "@/lib/ops-auth";

/** Claim photos are private: only staff and the customer who uploaded them can see them. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/claim-photos/[id]">) {
  const { id } = await ctx.params;
  const photo = await db.claimPhoto.findUnique({ where: { id }, include: { claim: { select: { userId: true } } } });
  if (!photo) return new NextResponse(null, { status: 404 });
  const staff = await isOpsSession();
  const user = staff ? null : await getCurrentUser();
  if (!staff && user?.id !== photo.claim.userId) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
