import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { safeEqual, secret } from "@/lib/crypto";
import { readLinkCode } from "@/lib/telegram-codes";
import { sendTelegram } from "@/lib/telegram";
import { site } from "@/lib/site";

type Update = { message?: { text?: string; chat?: { id: number; type: string; title?: string; first_name?: string } } };

/**
 * Telegram calls this for messages to the bot. "/start <code>" (from a link in
 * the partner portal or /ops) connects that chat to a person or to HQ;
 * "/stop" disconnects it. Always answers 200 so Telegram doesn't retry.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as Update;
  const chat = update.message?.chat;
  const text = update.message?.text?.trim() ?? "";
  if (!chat) return NextResponse.json({ ok: true });
  const chatId = String(chat.id);

  if (/^\/stop(@\w+)?$/.test(text)) {
    await db.telegramChat.deleteMany({ where: { chatId } });
    await sendTelegram(chatId, `${site.name}: alerts turned off for this chat.`);
    return NextResponse.json({ ok: true });
  }

  const m = /^\/start(?:@\w+)?\s+(\S+)$/.exec(text);
  if (!m) {
    if (text.startsWith("/start")) await sendTelegram(chatId, `${site.name}: open the "Connect Telegram" link from the partner portal or HQ screen to turn on alerts.`);
    return NextResponse.json({ ok: true });
  }
  const target = readLinkCode(m[1], secret());
  if (!target) {
    await sendTelegram(chatId, `${site.name}: that link has expired. Please get a new one from the website.`);
    return NextResponse.json({ ok: true });
  }

  if (target === "hq") {
    await db.telegramChat.upsert({ where: { chatId }, create: { chatId, isHq: true, title: chat.title ?? chat.first_name ?? null }, update: { isHq: true, userId: null } });
    await sendTelegram(chatId, `${site.name}: this chat will now receive HQ alerts (payments to check, stock requests, delivery shortfalls). Send /stop to turn them off.`);
  } else {
    const member = await db.distributorMember.findUnique({ where: { userId: target.userId }, include: { distributor: true } });
    if (!member) {
      await sendTelegram(chatId, `${site.name}: this link isn't for a distributor account.`);
      return NextResponse.json({ ok: true });
    }
    await db.telegramChat.upsert({ where: { chatId }, create: { chatId, userId: target.userId, title: chat.first_name ?? null }, update: { userId: target.userId, isHq: false } });
    await sendTelegram(chatId, `${site.name}: connected. You'll get ${member.distributor.name}'s alerts here: new orders, payments to confirm, stock and statements. Send /stop to turn them off.`);
  }
  return NextResponse.json({ ok: true });
}
