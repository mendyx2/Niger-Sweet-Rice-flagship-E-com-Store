/** Runs once when the server starts: in production, refuse to start without essential settings. */
export async function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkEnv } = await import("./lib/env-check");
  const { missing, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[settings] ${w}`);
  if (missing.length) {
    const msg = `Missing site settings:\n  - ${missing.join("\n  - ")}`;
    console.error(`[settings] ${msg}`);
    throw new Error(msg);
  }
}
