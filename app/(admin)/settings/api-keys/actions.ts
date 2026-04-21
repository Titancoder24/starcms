"use server";

import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";

export async function createApiKeyAction(input: {
  label: string;
  scope: "read" | "write" | "admin";
  siteId: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const { full, prefix } = generateApiKey();
  const hash = await hashApiKey(full);

  const rows = await db
    .insert(apiKeys)
    .values({
      userId: session.user.id,
      siteId: input.siteId,
      label: input.label,
      keyPrefix: prefix,
      keyHash: hash,
      scope: input.scope,
    })
    .returning({
      id: apiKeys.id,
      label: apiKeys.label,
      keyPrefix: apiKeys.keyPrefix,
      scope: apiKeys.scope,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    });

  const row = rows[0];
  if (!row) return { error: "Failed to create key" };

  return { key: full, keyInfo: row };
}

export async function revokeApiKeyAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id));
  return { ok: true };
}
