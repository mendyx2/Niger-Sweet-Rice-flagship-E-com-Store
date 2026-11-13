"use server";

import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { normalizeNgPhone, maskPhone } from "@/lib/phone";
import { makeReferralCode } from "@/lib/auth";
import { dispatchBags, RestockError } from "@/lib/restock";
import { sendSms } from "@/lib/sms";
import { alertHq, notifyDistributor } from "@/lib/staff-alerts";
import { isTelegramConfigured, registerWebhook } from "@/lib/telegram";
import { site } from "@/lib/site";
import { TAGS } from "@/lib/catalogue";

export type FormState = { ok: boolean; message: string } | null;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);

const details = z.object({
  name: z.string().trim().min(2, "Enter the distributor's name.").max(100),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  hours: z.string().trim().max(120).optional(),
});

export async function createDistributor(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const parsed = details.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const f = parsed.data;
  const phone = f.phone ? normalizeNgPhone(f.phone) : null;
  if (f.phone && !phone) return { ok: false, message: "Enter a valid Nigerian phone number." };
  let slug = slugify(f.name) || "distributor";
  if (await db.distributor.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const d = await db.distributor.create({ data: { name: f.name, slug, phone, address: f.address || null, hours: f.hours || null } });
  const variants = await db.variant.findMany({ select: { id: true } });
  await db.distributorStock.createMany({ data: variants.map((v) => ({ distributorId: d.id, variantId: v.id })), skipDuplicates: true });
  await db.auditLog.create({ data: { actor, action: "distributor.create", entity: "Distributor", entityId: d.id, after: { name: d.name } } });
  redirect(`/ops/distributors/${d.id}`);
}

export async function updateDistributor(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  const parsed = details.extend({
    slaHours: z.coerce.number().int().min(1).max(72),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    alertEmail: z.union([z.literal(""), z.email("Enter a valid alert email.").max(120)]).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const f = parsed.data;
  const phone = f.phone ? normalizeNgPhone(f.phone) : null;
  if (f.phone && !phone) return { ok: false, message: "Enter a valid Nigerian phone number." };
  const before = await db.distributor.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "Distributor not found." };
  if (before.isHq && f.status === "SUSPENDED") return { ok: false, message: "HQ can't be suspended." };
  const after = { name: f.name, phone, address: f.address || null, hours: f.hours || null, slaHours: f.slaHours, status: f.status, alertEmail: f.alertEmail?.toLowerCase() || null };
  await db.$transaction([
    db.distributor.update({ where: { id }, data: after }),
    db.auditLog.create({ data: { actor, action: "distributor.update", entity: "Distributor", entityId: id, before: { status: before.status, name: before.name }, after } }),
  ]);
  updateTag(TAGS.zones);
  refresh();
  return { ok: true, message: f.status === "SUSPENDED" ? "Saved. This distributor is suspended: its areas are served by HQ." : "Saved." };
}

const bank = z.object({
  bankName: z.string().trim().min(2, "Enter the bank name.").max(60),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account numbers (NUBAN) have 10 digits."),
  accountName: z.string().trim().min(3, "Enter the account name exactly as the bank shows it.").max(100),
});

/**
 * Only HQ can set where customers pay. Every change is logged and the
 * distributor is alerted by SMS, so a hijacked login can't redirect payments.
 */
export async function updateBankDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps({ ownerOnly: true });
  const id = String(formData.get("id") ?? "");
  const parsed = bank.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = await db.distributor.findUnique({ where: { id }, include: { members: { where: { role: "OWNER" }, include: { user: true } } } });
  if (!d) return { ok: false, message: "Distributor not found." };
  const masked = (n: string | null) => (n ? `******${n.slice(-4)}` : null);
  await db.$transaction([
    db.distributor.update({ where: { id }, data: { ...parsed.data, bankUpdatedAt: new Date() } }),
    db.auditLog.create({
      data: { actor, action: "distributor.bank_change", entity: "Distributor", entityId: id,
        before: { bankName: d.bankName, accountNumber: masked(d.accountNumber), accountName: d.accountName },
        after: { bankName: parsed.data.bankName, accountNumber: masked(parsed.data.accountNumber), accountName: parsed.data.accountName } },
    }),
  ]);
  const alertTo = [d.phone, ...d.members.map((m) => m.user.phone)].filter((p): p is string => !!p && p.startsWith("+"));
  for (const to of new Set(alertTo)) {
    await sendSms(to, `${site.name}: the bank account customers pay ${d.name} into was changed to ${parsed.data.bankName} ******${parsed.data.accountNumber.slice(-4)}. If you didn't request this, call HQ now.`);
  }
  refresh();
  return { ok: true, message: `Bank details saved.${alertTo.length ? ` ${d.name} has been alerted by SMS.` : ""}` };
}

/** One distributor per area: assigning an area moves it from any previous owner. */
export async function updateAreas(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  const d = await db.distributor.findUnique({ where: { id } });
  if (!d || d.isHq) return { ok: false, message: "HQ serves every area as the fallback; assign areas to distributors." };
  const wanted = new Set(formData.getAll("zone").map(String));
  const zones = await db.deliveryZone.findMany({ where: { kind: { not: "PICKUP" } } });
  const moved: string[] = [];
  await db.$transaction(async (tx) => {
    for (const z of zones) {
      const has = z.distributorId === id;
      if (wanted.has(z.id) && !has) {
        if (z.distributorId) moved.push(z.name);
        await tx.deliveryZone.update({ where: { id: z.id }, data: { distributorId: id } });
        // Start from HQ's fee for the area; the distributor can change it in their portal.
        await tx.distributorZoneFee.upsert({
          where: { distributorId_zoneId: { distributorId: id, zoneId: z.id } },
          create: { distributorId: id, zoneId: z.id, baseFeeKobo: z.baseFeeKobo, perKgFeeKobo: z.perKgFeeKobo, minOrderKg: z.minOrderKg, minOrderKobo: z.minOrderKobo, etaHours: z.etaHours, terms: z.terms },
          update: {},
        });
      } else if (!wanted.has(z.id) && has) {
        await tx.deliveryZone.update({ where: { id: z.id }, data: { distributorId: null } });
      }
    }
    await tx.auditLog.create({ data: { actor, action: "distributor.areas", entity: "Distributor", entityId: id, after: { zones: [...wanted] } } });
  });
  updateTag(TAGS.zones);
  refresh();
  return { ok: true, message: `Areas saved.${moved.length ? ` Moved from another distributor: ${moved.join(", ")}.` : ""}` };
}

export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  const phone = normalizeNgPhone(String(formData.get("phone") ?? ""));
  const role = formData.get("role") === "OWNER" ? "OWNER" : "STAFF";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  if (!phone) return { ok: false, message: "Enter a valid Nigerian mobile number." };
  const d = await db.distributor.findUnique({ where: { id } });
  if (!d) return { ok: false, message: "Distributor not found." };
  const user = (await db.user.findUnique({ where: { phone }, include: { distributorMember: true } }))
    ?? (await db.user.create({ data: { phone, name, referralCode: makeReferralCode(name) }, include: { distributorMember: true } }));
  if (user.roles.includes("OWNER") || user.roles.includes("STAFF")) {
    return { ok: false, message: `${maskPhone(phone)} is HQ staff and can't also join a distributor team.` };
  }
  if (user.distributorMember && user.distributorMember.distributorId !== id) {
    return { ok: false, message: `${maskPhone(phone)} already belongs to another distributor.` };
  }
  await db.distributorMember.upsert({ where: { userId: user.id }, create: { userId: user.id, distributorId: id, role }, update: { role } });
  if (name && !user.name) await db.user.update({ where: { id: user.id }, data: { name } });
  await db.auditLog.create({ data: { actor, action: "distributor.member_add", entity: "Distributor", entityId: id, after: { userId: user.id, role } } });
  await sendSms(phone, `${site.name}: you've been added to ${d.name} on the ${site.name} partner portal. Sign in with this number at ${site.url}/partner`);
  refresh();
  return { ok: true, message: `Added ${maskPhone(phone)} as ${role.toLowerCase()}. They've been sent a sign-in link.` };
}

export async function removeMember(formData: FormData) {
  const actor = await requireOps();
  const userId = String(formData.get("userId") ?? "");
  const m = await db.distributorMember.findUnique({ where: { userId } });
  if (!m) return;
  await db.$transaction([
    db.distributorMember.delete({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }), // sign them out everywhere
    db.auditLog.create({ data: { actor, action: "distributor.member_remove", entity: "Distributor", entityId: m.distributorId, after: { userId } } }),
  ]);
  refresh();
}

/** HQ sends bags: they leave HQ's shelf now and show as "in transit" until the distributor confirms receipt. */
export async function sendStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 60) || null;
  const d = await db.distributor.findUnique({ where: { id } });
  if (!d || d.isHq) return { ok: false, message: "Choose a distributor to send stock to." };
  const variants = await db.variant.findMany();
  const lines = variants
    .map((v) => ({ v, qty: Number(formData.get(`qty:${v.id}`) || 0) }))
    .filter((l) => l.qty !== 0);
  if (!lines.length) return { ok: false, message: "Enter how many bags to send." };
  if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 0 || l.qty > 100_000)) return { ok: false, message: "Quantities must be whole numbers." };

  try {
    await db.$transaction((tx) => dispatchBags(tx, id, d.name, lines.map(({ v, qty }) => ({ variantId: v.id, sizeKg: v.sizeKg, qty })), actor, reference ?? undefined));
  } catch (e) {
    if (e instanceof RestockError) return { ok: false, message: e.message };
    throw e;
  }
  await notifyDistributor(id, "Stock on its way", `HQ has dispatched ${lines.map((l) => `${l.qty}×${l.v.sizeKg}kg`).join(", ")}${reference ? ` (ref ${reference})` : ""}. Confirm when received: ${site.url}/partner/stock`);
  updateTag(TAGS.catalogue);
  refresh();
  return { ok: true, message: `Dispatched ${lines.map((l) => `${l.qty} × ${l.v.sizeKg}kg`).join(", ")}. It shows as in transit until ${d.name} confirms receipt.` };
}

/** Damage write-offs and count corrections from distributors only change stock once HQ approves. */
export async function reviewAdjustment(formData: FormData) {
  const actor = await requireOps();
  const id = String(formData.get("movementId") ?? "");
  const approve = formData.get("decision") === "approve";
  await db.$transaction(async (tx) => {
    const m = await tx.stockMovement.findUnique({ where: { id } });
    if (!m || m.status !== "PENDING_APPROVAL") return;
    if (approve) {
      const rows = await tx.$queryRaw<{ onHand: number }[]>`
        UPDATE "DistributorStock" SET "onHand" = "onHand" + ${m.delta}, "updatedAt" = NOW()
        WHERE "distributorId" = ${m.distributorId} AND "variantId" = ${m.variantId} RETURNING "onHand"`;
      await tx.stockMovement.update({ where: { id }, data: { status: "APPLIED", onHandAfter: rows[0]?.onHand, note: `${m.note ?? ""} (approved by HQ)`.trim() } });
    } else {
      await tx.stockMovement.update({ where: { id }, data: { status: "REJECTED", note: `${m.note ?? ""} (rejected by HQ)`.trim() } });
    }
    await tx.auditLog.create({ data: { actor, action: approve ? "stock.adjust_approved" : "stock.adjust_rejected", entity: "StockMovement", entityId: id } });
  });
  refresh();
}

// ─── HQ alert channels ──────────────────────────────────────────────────────

export async function removeHqChat(formData: FormData) {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  await db.telegramChat.deleteMany({ where: { id, isHq: true } });
  await db.auditLog.create({ data: { actor, action: "alerts.hq_chat_remove", entity: "TelegramChat", entityId: id } });
  refresh();
}

/** Tells Telegram where to deliver messages for our bot. Needs the live https site. */
export async function setupTelegramBot(): Promise<FormState> {
  await requireOps();
  if (!isTelegramConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { ok: false, message: "Add TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET to the site settings first." };
  }
  if (!site.url.startsWith("https://")) return { ok: false, message: "The site must be live on https before Telegram can reach it." };
  try {
    await registerWebhook(`${site.url}/api/telegram/webhook`);
    return { ok: true, message: "Telegram bot is connected to the site." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Telegram setup failed." };
  }
}

export async function testHqAlert(): Promise<FormState> {
  await requireOps();
  const sent = await alertHq("This is a test alert. If you can read this, HQ alerts are working.", "Test alert");
  return sent ? { ok: true, message: `Test alert sent to ${sent} place${sent === 1 ? "" : "s"}.` } : { ok: false, message: "No HQ Telegram chat or alert email is connected yet." };
}
