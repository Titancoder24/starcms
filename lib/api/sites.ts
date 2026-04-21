import { db } from "@/lib/db/client";
import { sites, type Site, type NewSite } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { ApiError } from "./errors";

const SiteSettingsSchema = z.object({
  verificationTokens: z
    .object({
      google: z.string().optional(),
      bing: z.string().optional(),
      yandex: z.string().optional(),
      naver: z.string().optional(),
      baidu: z.string().optional(),
      pinterest: z.string().optional(),
      yahoo: z.string().optional(),
    })
    .optional(),
  organization: z
    .object({
      legalName: z.string().optional(),
      logoUrl: z.string().optional(),
      sameAs: z.array(z.string()).optional(),
    })
    .optional(),
  defaultAuthorId: z.string().optional(),
  timezone: z.string().optional(),
  minWordCounts: z
    .object({
      post: z.number().min(50).optional(),
      page: z.number().min(50).optional(),
    })
    .optional(),
  readabilityThreshold: z.number().min(0).max(100).optional(),
  pagespeedApiKey: z.string().optional(),
  robotsConfig: z
    .object({
      disallowGptBot: z.boolean().optional(),
      disallowClaudeBot: z.boolean().optional(),
      disallowGoogleExtended: z.boolean().optional(),
      disallowPerplexityBot: z.boolean().optional(),
      disallowCCBot: z.boolean().optional(),
      disallowBytespider: z.boolean().optional(),
    })
    .optional(),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export async function listSites(userId: string): Promise<Site[]> {
  return db.select().from(sites).where(eq(sites.ownerId, userId));
}

export async function getSite(
  siteId: string,
  userId: string
): Promise<Site> {
  const rows = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Site not found", 404);
  return row;
}

export async function createSite(
  userId: string,
  input: { name: string; slug: string; domain?: string }
): Promise<Site> {
  const existing = await db
    .select()
    .from(sites)
    .where(eq(sites.slug, input.slug))
    .limit(1);
  if (existing[0]) {
    throw new ApiError("conflict", "Site slug already taken", 409);
  }
  const rows = await db
    .insert(sites)
    .values({ ...input, ownerId: userId })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create site", 500);
  return row;
}

export async function updateSiteSettings(
  siteId: string,
  userId: string,
  patch: Partial<NewSite>
): Promise<Site> {
  await getSite(siteId, userId);
  const rows = await db
    .update(sites)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sites.id, siteId))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to update site", 500);
  return row;
}

export async function getOrCreateDefaultSite(userId: string): Promise<Site> {
  const all = await listSites(userId);
  if (all[0]) return all[0];
  throw new ApiError("not-found", "No site found for user", 404);
}
