import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { syncStockSheet } from "@/lib/stock-sheet";
import { confirmDuePoints, expireOldPoints, paymentFollowUps, releaseExpiredReservations, sendSampleFollowUps } from "@/lib/orders";

/** Housekeeping: frees stock held by unpaid orders, confirms points past the return window,
 * expires year-old points, sends sample follow-up coupons, payment reminders and HQ escalations,
 * and sends new stock movements to the Google stock sheet. Call every 5–10 minutes (e.g. Vercel Cron) with "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ ok: false }, { status: 401 });
  const released = await releaseExpiredReservations();
  const payments = await paymentFollowUps();
  const pointsConfirmed = await confirmDuePoints();
  const pointsExpired = await expireOldPoints();
  const sampleFollowUps = await sendSampleFollowUps();
  // The sheet is a copy: a Google outage must not stop the rest of the housekeeping.
  const sheet = await syncStockSheet().catch((e) => ({ error: String(e).slice(0, 200) }));
  return NextResponse.json({ ok: true, released, ...payments, pointsConfirmed, pointsExpired, sampleFollowUps, sheet });
}
