import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getCurrentUser, type CurrentUser } from "./auth";
import { normalizeNgPhone } from "./phone";

/**
 * HQ staff access for /ops: each person signs in with their own phone number
 * and SMS code (same login as everyone else) and needs an HQ role:
 *   OWNER: everything, including the HQ team and distributors' bank details
 *   STAFF: day-to-day operations
 * HQ_OWNER_PHONES (comma-separated) are always owners, so HQ can't be locked out.
 */
export type HqRole = "OWNER" | "STAFF";

function bootstrapOwners(): Set<string> {
  return new Set(
    (process.env.HQ_OWNER_PHONES ?? "").split(",").map((p) => normalizeNgPhone(p.trim())).filter((p): p is string => !!p),
  );
}

export async function getHqStaff(): Promise<{ user: CurrentUser; role: HqRole } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (bootstrapOwners().has(user.phone) && !user.roles.includes("OWNER")) {
    await db.user.update({ where: { id: user.id }, data: { roles: [...new Set([...user.roles, "OWNER" as const])] } });
    return { user, role: "OWNER" };
  }
  if (user.roles.includes("OWNER")) return { user, role: "OWNER" };
  if (user.roles.includes("STAFF")) return { user, role: "STAFF" };
  return null;
}

export async function isOpsSession(): Promise<boolean> {
  return !!(await getHqStaff());
}

/** Call at the top of every /ops page AND every ops server action. Returns the audit actor id. */
export async function requireOps(opts: { ownerOnly?: boolean } = {}): Promise<string> {
  const staff = await getHqStaff();
  if (!staff) {
    if (await getCurrentUser()) redirect("/ops/login?denied=1");
    redirect("/ops/login");
  }
  if (opts.ownerOnly && staff.role !== "OWNER") redirect("/ops/orders?owner=1");
  return `hq:${staff.user.id}`;
}
