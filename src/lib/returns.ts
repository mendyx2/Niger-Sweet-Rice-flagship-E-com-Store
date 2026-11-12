import { RETURN_WINDOW_HOURS } from "./rewards";

/** Replacement claims must be raised within 48 hours of delivery. */
export function canClaimReplacement(deliveredAt: Date | null, now = new Date()): boolean {
  if (!deliveredAt) return false;
  return now.getTime() - deliveredAt.getTime() <= RETURN_WINDOW_HOURS * 3600_000;
}
