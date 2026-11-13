import "server-only";
import { secret } from "./crypto";
import { botUsername, isTelegramConfigured } from "./telegram";
import { makeLinkCode } from "./telegram-codes";

/** t.me links that connect a chat to a person (or HQ) when opened. Null when the bot isn't set up. */
export async function telegramLinks(target: { userId: string } | "hq") {
  const bot = await botUsername();
  if (!bot) return null;
  const code = makeLinkCode(target, secret());
  return {
    personal: `https://t.me/${bot}?start=${code}`,
    group: `https://t.me/${bot}?startgroup=${code}`,
    code,
    live: isTelegramConfigured(),
  };
}
