import "server-only";
import { db } from "./db";
import { normalizePem, serviceAccountJwt } from "./google-auth";
import { movementRow, MOVEMENT_HEADER, STOCK_HEADER, stockRows } from "./stock-sheet-rows";

/**
 * Google "stock depletion" sheet: every finished stock movement is appended as
 * a row ("Stock movements" tab) and the "Current stock" tab is rewritten with
 * stock and days of cover per distributor. The platform is the source of truth;
 * edits typed into the sheet don't change stock.
 *
 * Enabled by GOOGLE_SHEETS_ID + GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_KEY,
 * with the sheet shared (Editor) with the service account's email.
 * Rows not yet sent are retried on the next run, so nothing is lost if Google is unreachable.
 */
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const MOVES = "Stock movements";
const STOCK = "Current stock";
let token: { value: string; expires: number } | null = null;

export const isSheetConfigured = () =>
  !!(process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const assertion = serviceAccountJwt(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, normalizePem(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!), SCOPE);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google auth failed: ${res.status} ${body.error ?? ""}`);
  token = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function sheets(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const range = (tab: string, r: string) => encodeURIComponent(`'${tab}'!${r}`);

/** Creates the two tabs (with headers) if the sheet doesn't have them yet. */
async function ensureTabs() {
  const meta = (await sheets("?fields=sheets.properties.title")) as { sheets: { properties: { title: string } }[] };
  const have = new Set(meta.sheets.map((s) => s.properties.title));
  const missing = [MOVES, STOCK].filter((t) => !have.has(t));
  if (!missing.length) return;
  await sheets(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }) });
  if (missing.includes(MOVES)) {
    await sheets(`/values/${range(MOVES, "A1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [MOVEMENT_HEADER] }) });
  }
}

export async function syncStockSheet(): Promise<{ skipped?: true; appended: number }> {
  if (!isSheetConfigured()) return { skipped: true, appended: 0 };
  await ensureTabs();

  // Movements waiting for HQ approval are sent once decided, so each row is final.
  const pending = await db.stockMovement.findMany({
    where: { sheetSyncedAt: null, status: { not: "PENDING_APPROVAL" } },
    include: { distributor: { select: { name: true } }, variant: { select: { sizeKg: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (pending.length) {
    await sheets(`/values/${range(MOVES, "A:K")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: pending.map(movementRow) }),
    });
    await db.stockMovement.updateMany({ where: { id: { in: pending.map((m) => m.id) } }, data: { sheetSyncedAt: new Date() } });
  }

  // Current stock and days of cover (average daily usage over the last 14 days).
  const since = new Date(Date.now() - 14 * 86400_000);
  const [stock, sales] = await Promise.all([
    db.distributorStock.findMany({ include: { distributor: { select: { name: true, isHq: true } }, variant: { select: { sizeKg: true } } } }),
    db.stockMovement.groupBy({
      by: ["distributorId", "variantId"],
      // Usage = bags sold, plus (for HQ) bags sent to distributors.
      where: { createdAt: { gte: since }, status: "APPLIED", type: { in: ["ONLINE_SALE", "WALK_IN_SALE", "RESTOCK_SENT"] } },
      _sum: { delta: true },
    }),
  ]);
  const sold = new Map(sales.map((s) => [`${s.distributorId}:${s.variantId}`, -(s._sum.delta ?? 0)]));
  await sheets(`/values/${range(STOCK, "A:Z")}:clear`, { method: "POST", body: "{}" });
  await sheets(`/values/${range(STOCK, "A1")}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [STOCK_HEADER, ...stockRows(stock.map((s) => ({ ...s, sold14: sold.get(`${s.distributorId}:${s.variantId}`) ?? 0 })))] }),
  });
  return { appended: pending.length };
}
