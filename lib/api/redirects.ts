import { db } from "@/lib/db/client";
import { redirects, type Redirect } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ApiError } from "./errors";

export async function listRedirects(siteId: string): Promise<Redirect[]> {
  return db.select().from(redirects).where(eq(redirects.siteId, siteId));
}

export async function createRedirect(
  siteId: string,
  input: { fromPath: string; toPath: string; statusCode?: number }
): Promise<Redirect> {
  const rows = await db
    .insert(redirects)
    .values({
      siteId,
      fromPath: input.fromPath,
      toPath: input.toPath,
      statusCode: input.statusCode ?? 301,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create redirect", 500);
  return row;
}

export async function deleteRedirect(id: string, siteId: string): Promise<void> {
  const rows = await db
    .select()
    .from(redirects)
    .where(and(eq(redirects.id, id), eq(redirects.siteId, siteId)))
    .limit(1);
  if (!rows[0]) throw new ApiError("not-found", "Redirect not found", 404);
  await db.delete(redirects).where(eq(redirects.id, id));
}
