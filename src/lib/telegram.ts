import "server-only";

/**
 * Telegram bot for staff alerts (free). Set TELEGRAM_BOT_TOKEN (from @BotFather)
 * and TELEGRAM_WEBHOOK_SECRET. Without a token, in development, messages are
 * printed to the server console instead.
 */
const API = "https://api.telegram.org";
const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
export const isTelegramConfigured = () => token().length > 0;

async function call<T>(method: string, body: object): Promise<T> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(`Telegram ${method} failed: ${json?.description ?? res.status}`);
  return json.result as T;
}

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!isTelegramConfigured()) {
    if (process.env.NODE_ENV !== "production") console.info(`[telegram:dev] to ${chatId}: ${text}`);
    return process.env.NODE_ENV !== "production";
  }
  try {
    await call("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
    return true;
  } catch (e) {
    console.error("[telegram]", e);
    return false;
  }
}

let username: string | null = null;
/** The bot's @username, for t.me links. */
export async function botUsername(): Promise<string | null> {
  if (username) return username;
  if (!isTelegramConfigured()) return process.env.NODE_ENV !== "production" ? "NaijaSweetRiceDevBot" : null;
  try {
    username = (await call<{ username: string }>("getMe", {})).username;
    return username;
  } catch {
    return null;
  }
}

/** Points Telegram at our webhook (run once after deploying, from /ops). */
export async function registerWebhook(url: string): Promise<void> {
  await call("setWebhook", {
    url,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}
