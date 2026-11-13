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

type PayTo = { distributorName?: string; bankName?: string | null; accountNumber?: string | null; accountName?: string | null };

/** Customer: how to pay. Distributor: a new order is waiting for payment. */
export async function notifyNewTransferOrder(
  o: { number: string; contactPhone: string; totalKobo: number; payTo: PayTo },
  distributorPhone: string | null,
  hours: number,
) {
  const p = o.payTo;
  await sendSms(
    o.contactPhone,
    `${site.name}: order ${o.number}. Please transfer ${formatNaira(o.totalKobo)} to ${p.bankName} ${p.accountNumber} (${p.accountName}) within ${hours} hours. Use ${o.number} as the narration. Details: ${site.url}/orders/${o.number}`,
  ).catch(() => {});
  if (distributorPhone) {
    await sendSms(distributorPhone, `${site.name}: new order ${o.number} for ${formatNaira(o.totalKobo)}, awaiting the customer's transfer. ${site.url}/partner`).catch(() => {});
  }
}

export async function notifyCustomerSaysPaid(o: { number: string; totalKobo: number }, distributorPhone: string | null) {
  if (!distributorPhone) return;
  await sendSms(distributorPhone, `${site.name}: customer says they've paid ${formatNaira(o.totalKobo)} for ${o.number}. Check your bank and confirm: ${site.url}/partner`).catch(() => {});
}

export async function notifyPaymentNotReceived(o: { number: string; contactPhone: string; totalKobo: number }) {
  await sendSms(
    o.contactPhone,
    `${site.name}: we haven't received your transfer of ${formatNaira(o.totalKobo)} for ${o.number} yet. Please check the account details at ${site.url}/orders/${o.number}`,
  ).catch(() => {});
}

export async function notifyPaymentReminder(o: { number: string; contactPhone: string; totalKobo: number }) {
  await sendSms(o.contactPhone, `${site.name}: reminder: order ${o.number} is held for 1 more hour. Transfer ${formatNaira(o.totalKobo)} and tap "I've paid": ${site.url}/orders/${o.number}`).catch(() => {});
}

/** HQ alerts (escalations, low stock). Sent to OPS_ALERT_PHONE if set. */
export async function alertHq(message: string) {
  const to = process.env.OPS_ALERT_PHONE;
  if (to) await sendSms(to, `${site.name} HQ: ${message}`).catch(() => {});
  else console.info(`[hq-alert] ${message}`);
}
