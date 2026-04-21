import { db } from "@/lib/db/client";
import { pages, redirects, type Page } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { ApiError } from "./errors";
import { slugify } from "@/lib/util/slugify";

export const PageInputSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(500),
  mdxBody: z.string().default(""),
  excerpt: z.string().max(500).optional(),
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(300).optional(),
  canonical: z.string().url().optional(),
  authorId: z.string().uuid().optional(),
  coverMediaId: z.string().uuid().optional(),
  seo: z
    .object({
      openGraphImage: z.string().url().optional(),
      twitterCardType: z.enum(["summary", "summary_large_image"]).optional(),
      noIndex: z.boolean().optional(),
      noFollow: z.boolean().optional(),
    })
    .optional(),
});

export type PageInput = z.infer<typeof PageInputSchema>;

export async function listPages(
  siteId: string,
  opts: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ items: Page[]; hasMore: boolean }> {
  const { status, limit = 20, offset = 0 } = opts;
  const conditions = [eq(pages.siteId, siteId)];
  if (status) conditions.push(eq(pages.status, status as "draft" | "published" | "scheduled" | "archived"));
  const rows = await db
    .select()
    .from(pages)
    .where(and(...conditions))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(desc(pages.updatedAt));
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getPage(id: string, siteId: string): Promise<Page> {
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, id), eq(pages.siteId, siteId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Page not found", 404);
  return row;
}

export async function getPageBySlug(slug: string, siteId: string): Promise<Page> {
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.siteId, siteId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Page not found", 404);
  return row;
}

export async function createPage(siteId: string, input: PageInput): Promise<Page> {
  const slug = input.slug ?? slugify(input.title);
  const existing = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug)))
    .limit(1);
  if (existing[0]) throw new ApiError("conflict", `Slug '${slug}' already exists`, 409);
  const rows = await db
    .insert(pages)
    .values({ siteId, slug, ...input })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create page", 500);
  return row;
}

export async function updatePage(
  id: string,
  siteId: string,
  input: Partial<PageInput>
): Promise<Page> {
  const existing = await getPage(id, siteId);
  if (input.slug && input.slug !== existing.slug && existing.status === "published") {
    await db.insert(redirects).values({
      siteId,
      fromPath: `/${existing.slug}`,
      toPath: `/${input.slug}`,
      statusCode: 301,
    });
  }
  const rows = await db
    .update(pages)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to update page", 500);
  return row;
}

export async function publishPage(id: string, siteId: string): Promise<Page> {
  await getPage(id, siteId);
  const rows = await db
    .update(pages)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to publish page", 500);
  return row;
}

export async function unpublishPage(id: string, siteId: string): Promise<Page> {
  await getPage(id, siteId);
  const rows = await db
    .update(pages)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to unpublish page", 500);
  return row;
}

export async function deletePage(id: string, siteId: string): Promise<void> {
  await getPage(id, siteId);
  await db.delete(pages).where(eq(pages.id, id));
}

export async function getPublishedPagesForSitemap(
  siteId: string
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return db
    .select({ slug: pages.slug, updatedAt: pages.updatedAt })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, "published")));
}
