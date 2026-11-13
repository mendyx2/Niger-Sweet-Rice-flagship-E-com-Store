import "server-only";
import { db } from "./db";
import { sendTelegram } from "./telegram";
import { sendEmail } from "./email";
import { site } from "./site";

/**
 * Staff alerts (free channels, no SMS): Telegram chats each team member has
 * connected, plus the distributor's alert email. HQ alerts go to HQ's Telegram
 * chat and OPS_ALERT_EMAIL. Never throws; returns how many deliveries worked.
 */
export async function notifyDistributor(distributorId: string, subject: string, text: string): Promise<number> {
  try {
    const d = await db.distributor.findUnique({
      where: { id: distributorId },
      include: { members: { include: { user: { include: { telegramChats: true } } } } },
    });
    if (!d) return 0;
    if (d.isHq) return alertHq(text, subject);
    const chats = d.members.flatMap((m) => m.user.telegramChats.map((c) => c.chatId));
    const results = await Promise.all([
      ...[...new Set(chats)].map((c) => sendTelegram(c, `${site.name}: ${text}`)),
      ...(d.alertEmail ? [sendEmail(d.alertEmail, `${site.name}: ${subject}`, text)] : []),
    ]);
    const sent = results.filter(Boolean).length;
    if (!sent) console.warn(`[staff-alert] ${d.name} has no Telegram or email connected; alert not delivered: ${subject}`);
    return sent;
  } catch (e) {
    console.error("[staff-alert]", e);
    return 0;
  }
}

export async function alertHq(text: string, subject = "HQ alert"): Promise<number> {
  try {
    const chats = await db.telegramChat.findMany({ where: { isHq: true } });
    const email = process.env.OPS_ALERT_EMAIL;
    const results = await Promise.all([
      ...chats.map((c) => sendTelegram(c.chatId, `${site.name} HQ: ${text}`)),
      ...(email ? [sendEmail(email, `${site.name} HQ: ${subject}`, text)] : []),
    ]);
    const sent = results.filter(Boolean).length;
    if (!sent) console.info(`[hq-alert] (no HQ Telegram or email connected) ${text}`);
    return sent;
  } catch (e) {
    console.error("[hq-alert]", e);
    return 0;
  }
}
