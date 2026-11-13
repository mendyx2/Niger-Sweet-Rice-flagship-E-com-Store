"use server";

import { refresh, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { TAGS } from "@/lib/catalogue";
import { cancelRestock, confirmRestockPayment, dispatchRestock, invoiceRestock, RestockError } from "@/lib/restock";

export type FormState = { ok: boolean; message: string } | null;

async function run(fn: () => Promise<string>): Promise<FormState> {
  try {
    const message = await fn();
    refresh();
    return { ok: true, message };
  } catch (e) {
    if (e instanceof RestockError) return { ok: false, message: e.message };
    throw e;
  }
}

export async function opsInvoiceRestock(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  const variants = await db.variant.findMany({ select: { id: true } });
  const read = (prefix: string) => {
    const m = new Map<string, number>();
    for (const v of variants) {
      const n = Number(formData.get(`${prefix}:${v.id}`) || 0);
      if (!Number.isInteger(n) || n < 0 || n > 100_000) throw new RestockError("Quantities must be whole numbers.");
      if (n) m.set(v.id, n);
    }
    return m;
  };
  return run(async () => {
    const total = await invoiceRestock(id, read("qty"), read("free"), actor);
    return total > 0 ? `Invoice sent for ${formatNaira(total)}. The distributor has the bank details by SMS.` : "No payment needed (free bags only). Ready to dispatch.";
  });
}

export async function opsConfirmRestockPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  return run(async () => {
    await confirmRestockPayment(String(formData.get("id") ?? ""), actor);
    return "Payment confirmed. Ready to dispatch.";
  });
}

export async function opsDispatchRestock(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 60) || null;
  return run(async () => {
    await dispatchRestock(String(formData.get("id") ?? ""), reference, actor);
    updateTag(TAGS.catalogue);
    return "Dispatched. It shows as in transit until the distributor confirms receipt.";
  });
}

export async function opsCancelRestock(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  return run(async () => {
    await cancelRestock(String(formData.get("id") ?? ""), actor);
    return "Cancelled.";
  });
}
