import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { paystackKey } from "@/lib/paystack";
import { isValidPaystackSignature, orderNumberFromReference } from "@/lib/paystack-signature";
import { markOrderPaid } from "@/lib/orders";

/** Paystack webhook. Configure the URL https://<site>/api/webhooks/paystack in the Paystack dashboard. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 100_000 || !isValidPaystackSignature(raw, req.headers.get("x-paystack-signature"), paystackKey())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: { event?: string; data?: { id?: number; reference?: string; amount?: number; currency?: string; status?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Record each event once; Paystack retries deliveries.
  const eventId = `${event.event}:${event.data?.id ?? event.data?.reference}`;
  try {
    await db.webhookEvent.create({ data: { provider: "paystack", eventId, payload: event as Prisma.InputJsonValue } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
    throw e;
  }

  if (event.event === "charge.success" && event.data?.status === "success" && event.data.reference) {
    const number = orderNumberFromReference(event.data.reference);
    if (number) {
      await markOrderPaid(number, {
        reference: event.data.reference,
        amountKobo: Number(event.data.amount),
        currency: String(event.data.currency),
        source: "paystack-webhook",
      });
    }
  }
  return NextResponse.json({ ok: true });
}
