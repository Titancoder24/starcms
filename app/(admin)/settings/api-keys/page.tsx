import { auth } from "@/lib/auth/config";
import { getOrCreateDefaultSite } from "@/lib/api/sites";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { ApiKeysManager } from "./manager";

export const metadata: Metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const site = await getOrCreateDefaultSite(session.user.id).catch(() => null);
  if (!site) return null;

  const keys = await db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      keyPrefix: apiKeys.keyPrefix,
      scope: apiKeys.scope,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id));

  return <ApiKeysManager keys={keys} siteId={site.id} />;
}
