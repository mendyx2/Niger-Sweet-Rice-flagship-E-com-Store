import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { confirmDuePoints, releaseExpiredReservations } from "@/lib/orders";

/** Frees stock held by unpaid orders and confirms points that are past the return window. Call every 5–10 minutes (e.g. Vercel Cron) with "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ ok: false }, { status: 401 });
  const released = await releaseExpiredReservations();
  const pointsConfirmed = await confirmDuePoints();
  return NextResponse.json({ ok: true, released, pointsConfirmed });
}
