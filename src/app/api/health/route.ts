import { NextResponse, connection } from "next/server";
import { db } from "@/lib/db";

/** For uptime monitors: 200 when the site and database are working, 503 otherwise. */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "database unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
