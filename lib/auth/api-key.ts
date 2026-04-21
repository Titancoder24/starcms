import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { ApiError } from "@/lib/api/errors";

export type ApiKeyContext = {
  userId: string;
  siteId: string;
  scope: "read" | "write" | "admin";
  keyId: string;
};

export function generateApiKey(): { full: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const full = `cms_live_${raw}`;
  const prefix = full.slice(0, 16);
  return { full, prefix };
}

export async function hashApiKey(key: string): Promise<string> {
  return argon2.hash(key, { type: argon2.argon2id });
}

export async function verifyApiKey(key: string): Promise<ApiKeyContext> {
  if (!key.startsWith("cms_live_")) {
    throw new ApiError("forbidden", "Invalid API key format", 401);
  }
  const prefix = key.slice(0, 16);

  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new ApiError("forbidden", "API key not found or revoked", 401);
  }

  const valid = await argon2.verify(row.keyHash, key);
  if (!valid) {
    throw new ApiError("forbidden", "Invalid API key", 401);
  }

  // Write-behind lastUsedAt (fire-and-forget, non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => undefined);

  return {
    userId: row.userId,
    siteId: row.siteId,
    scope: row.scope,
    keyId: row.id,
  };
}

export function requireScope(
  context: ApiKeyContext,
  required: "read" | "write" | "admin"
) {
  const hierarchy = { read: 0, write: 1, admin: 2 };
  if (hierarchy[context.scope] < hierarchy[required]) {
    throw new ApiError(
      "forbidden",
      `This action requires '${required}' scope`,
      403
    );
  }
}
