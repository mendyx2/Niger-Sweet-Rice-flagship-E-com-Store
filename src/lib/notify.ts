import "server-only";
import { sendSms } from "./sms";
import { site } from "./site";
import { formatNaira } from "./money";
import { STATUS_SMS } from "./status-text";
import type { OrderStatus } from "@prisma/client";

/** Customer notifications. SMS today; WhatsApp templates can be added alongside. Never throws. */
export async function notifyOrderPaid(o: { number: string; contactPhone: string; totalKobo: number }) {
  await sendSms(
    o.contactPhone,
    `${site.name}: payment of ${formatNaira(o.totalKobo)} received for order ${o.number}. Track it at ${site.url}/track`,
  ).catch(() => {});
}

export async function notifyStatus(o: { number: string; contactPhone: string }, status: OrderStatus, extra?: string) {
  const text = STATUS_SMS[status];
  if (!text) return;
  await sendSms(o.contactPhone, `${site.name}: order ${o.number} ${text}${extra ? ` ${extra}` : ""}`).catch(() => {});
}
