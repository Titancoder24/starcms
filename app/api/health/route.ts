import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  const status: Record<string, string> = {};

  // DB check
  try {
    await db.execute(sql`SELECT 1`);
    status["db"] = "ok";
  } catch {
    status["db"] = "error";
  }

  // KV check
  try {
    const { kv } = await import("@vercel/kv");
    await kv.ping();
    status["kv"] = "ok";
  } catch {
    status["kv"] = "unavailable";
  }

  const allOk = Object.values(status).every((s) => s === "ok" || s === "unavailable");
  return Response.json(
    { status: allOk ? "healthy" : "degraded", checks: status, version: "0.1.0" },
    { status: allOk ? 200 : 503 }
  );
}
