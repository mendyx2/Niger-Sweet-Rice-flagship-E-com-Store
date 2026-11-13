/** Row layouts for the Google stock depletion sheet (pure, unit tested). */

export const MOVEMENT_HEADER = ["Date (Lagos)", "Distributor", "Bag", "Movement", "Change (bags)", "In transit change", "Stock after", "Status", "Order / reference", "Recorded by", "Note"];
export const STOCK_HEADER = ["Distributor", "Bag", "On hand", "Held for unpaid orders", "In transit", "Sold/sent last 14 days", "Days of stock left", "Updated (Lagos)"];

const LABEL: Record<string, string> = {
  OPENING_BALANCE: "Opening balance", RESTOCK_SENT: "Sent by HQ", RESTOCK_RECEIVED: "Received from HQ", RESTOCK_SHORT: "Short on delivery",
  ONLINE_SALE: "Online sale", WALK_IN_SALE: "Shop sale", SAMPLE: "Free sample", REPLACEMENT: "Replacement bag",
  ORDER_CANCELLED: "Cancelled order returned", DAMAGED: "Damaged", COUNT_ADJUSTMENT: "Count correction", MANUAL_SET: "Set by HQ",
};

const lagos = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().replace("T", " ").slice(0, 16);

/** Who did it, without exposing internal ids: "partner:gova-max-ltd:<user>" → "gova-max-ltd". */
const who = (actor: string) => (actor.startsWith("partner:") ? actor.split(":")[1] : actor.startsWith("ops") || actor === "staff" ? "HQ staff" : actor.startsWith("c") && actor.length > 20 ? "customer" : actor);

export function movementRow(m: {
  createdAt: Date; distributor: { name: string }; variant: { sizeKg: number }; type: string; delta: number; transitDelta: number;
  onHandAfter: number | null; status: string; reference: string | null; actor: string; note: string | null;
}): (string | number)[] {
  return [
    lagos(m.createdAt), m.distributor.name, `${m.variant.sizeKg}kg`, LABEL[m.type] ?? m.type, m.delta, m.transitDelta,
    m.onHandAfter ?? "", m.status === "APPLIED" ? "Applied" : m.status === "REJECTED" ? "Rejected by HQ" : m.status,
    m.reference ?? "", who(m.actor), m.note ?? "",
  ];
}

export function stockRows(rows: { distributor: { name: string; isHq: boolean }; variant: { sizeKg: number }; onHand: number; held: number; inTransit: number; sold14: number }[], now = new Date()) {
  return [...rows]
    .sort((a, b) => Number(b.distributor.isHq) - Number(a.distributor.isHq) || a.distributor.name.localeCompare(b.distributor.name) || b.variant.sizeKg - a.variant.sizeKg)
    .map((r) => {
      const perDay = r.sold14 / 14;
      return [r.distributor.name, `${r.variant.sizeKg}kg`, r.onHand, r.held, r.inTransit, r.sold14, perDay > 0 ? Math.floor(r.onHand / perDay) : "no recent sales", lagos(now)];
    });
}
