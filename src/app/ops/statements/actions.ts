"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { closeStatement, currentMonth, isMonth, settleStatement } from "@/lib/statement";
import { formatNaira } from "@/lib/money";
import { notifyDistributor } from "@/lib/staff-alerts";
import { site } from "@/lib/site";

export type FormState = { ok: boolean; message: string } | null;

export async function closeMonth(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const month = String(formData.get("month") ?? "");
  if (!isMonth(month) || month >= currentMonth()) return { ok: false, message: "Only a finished month can be closed." };
  const distributors = await db.distributor.findMany({ where: { isHq: false } });
  for (const d of distributors) {
    const existed = await db.statement.findUnique({ where: { distributorId_month: { distributorId: d.id, month } } });
    const s = await closeStatement(d.id, month, actor);
    if (!existed && s.netKobo !== 0) {
      await notifyDistributor(d.id, `${month} statement`, `Your ${month} statement is ready: ${s.netKobo > 0 ? "you owe HQ" : "HQ owes you"} ${formatNaira(Math.abs(s.netKobo))}. Details: ${site.url}/partner/reports?m=${month}`);
    }
  }
  refresh();
  return { ok: true, message: `Statements for ${month} are closed and distributors have been notified.` };
}

export async function markSettled(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const ok = await settleStatement(String(formData.get("id") ?? ""), actor, String(formData.get("note") ?? "").trim().slice(0, 200) || null);
  if (ok) refresh();
  return ok ? { ok: true, message: "Marked as settled." } : { ok: false, message: "Already settled." };
}
