import { db } from "@/lib/db/client";
import {
  posts,
  redirects,
  tags,
  postTags,
  type Post,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { ApiError } from "./errors";
import { runGuardrails } from "@/lib/guardrails";
import { slugify } from "@/lib/util/slugify";
import { computeEmbedding } from "@/lib/util/similarity";
import { setTagsForPost, setCategoriesForPost } from "./taxonomy";

export const PostInputSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(500),
  mdxBody: z.string().default(""),
  excerpt: z.string().max(500).optional(),
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(300).optional(),
  canonical: z.string().url().optional(),
  authorId: z.string().uuid().optional(),
  coverMediaId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  seo: z
    .object({
      openGraphImage: z.string().url().optional(),
      twitterCardType: z.enum(["summary", "summary_large_image"]).optional(),
      noIndex: z.boolean().optional(),
      noFollow: z.boolean().optional(),
      structuredDataTypeOverride: z.string().optional(),
    })
    .optional(),
});

export type PostInput = z.infer<typeof PostInputSchema>;

export async function listPosts(
  siteId: string,
  opts: {
    status?: "draft" | "scheduled" | "published" | "archived";
    tag?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: Post[]; hasMore: boolean }> {
  const { status, limit = 20, offset = 0 } = opts;

  const conditions = [eq(posts.siteId, siteId)];
  if (status) conditions.push(eq(posts.status, status));

  let query = db
    .select()
    .from(posts)
    .where(and(...conditions))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(desc(posts.updatedAt))
    .$dynamic();

  if (opts.tag) {
    const tagRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.siteId, siteId), eq(tags.slug, opts.tag)))
      .limit(1);
    const tagId = tagRows[0]?.id;
    if (tagId) {
      const postIdsWithTag = await db
        .select({ postId: postTags.postId })
        .from(postTags)
        .where(eq(postTags.tagId, tagId));
      const ids = postIdsWithTag.map((r) => r.postId);
      if (ids.length === 0) return { items: [], hasMore: false };
      query = db
        .select()
        .from(posts)
        .where(and(...conditions, inArray(posts.id, ids)))
        .limit(limit + 1)
        .offset(offset)
        .orderBy(desc(posts.updatedAt))
        .$dynamic();
    }
  }

  const rows = await query;
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getPost(id: string, siteId: string): Promise<Post> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.siteId, siteId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Post not found", 404);
  return row;
}

export async function getPostBySlug(
  slug: string,
  siteId: string
): Promise<Post> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.siteId, siteId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Post not found", 404);
  return row;
}

export async function createPost(
  siteId: string,
  input: PostInput
): Promise<Post> {
  const slug = input.slug ?? slugify(input.title);

  const existing = await db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.slug, slug)))
    .limit(1);
  if (existing[0]) {
    throw new ApiError("conflict", `Slug '${slug}' already exists`, 409);
  }

  const rows = await db
    .insert(posts)
    .values({
      siteId,
      slug,
      title: input.title,
      mdxBody: input.mdxBody,
      excerpt: input.excerpt,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      canonical: input.canonical,
      authorId: input.authorId,
      coverMediaId: input.coverMediaId,
      scheduledAt: input.scheduledAt,
      seo: input.seo ?? {},
      status: "draft",
    })
    .returning();

  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create post", 500);

  if (input.tagIds) await setTagsForPost(row.id, input.tagIds);
  if (input.categoryIds) await setCategoriesForPost(row.id, input.categoryIds);

  return row;
}

export async function updatePost(
  id: string,
  siteId: string,
  input: Partial<PostInput>
): Promise<Post> {
  const existing = await getPost(id, siteId);

  // Handle slug change: create redirect if published
  if (input.slug && input.slug !== existing.slug && existing.status === "published") {
    await db.insert(redirects).values({
      siteId,
      fromPath: `/p/${existing.slug}`,
      toPath: `/p/${input.slug}`,
      statusCode: 301,
    });
  }

  const rows = await db
    .update(posts)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();

  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to update post", 500);

  if (input.tagIds !== undefined) await setTagsForPost(id, input.tagIds);
  if (input.categoryIds !== undefined) await setCategoriesForPost(id, input.categoryIds);

  return row;
}

export async function publishPost(
  id: string,
  siteId: string
): Promise<
  | { ok: true; post: Post }
  | {
      ok: false;
      code: "guardrail-failed";
      issues: Array<{
        code: string;
        severity: string;
        message: string;
        fix: string;
      }>;
    }
> {
  const post = await getPost(id, siteId);

  // Run guardrails
  const site = await (await import("./sites")).getSite(siteId, siteId).catch(
    async () => {
      const { listSites } = await import("./sites");
      const all = await listSites(siteId);
      return all[0];
    }
  );

  // Build site data for guardrails
  const siteData = await db.query.sites.findFirst({ where: (s) => eq(s.id, siteId) });
  const authorData = post.authorId
    ? await db.query.authors.findFirst({ where: (a) => eq(a.id, post.authorId!) })
    : undefined;

  // Get all published post bodies for duplicate detection
  const allPublished = await db
    .select({ id: posts.id, embedding: posts.embedding })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.status, "published")));

  // Get published post slugs for internal link checking
  const publishedPosts = await db
    .select({ id: posts.id, slug: posts.slug, mdxBody: posts.mdxBody })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.status, "published")));

  const result = await runGuardrails({
    post,
    site: siteData ?? null,
    author: authorData ?? null,
    allPublishedPosts: allPublished,
    publishedPosts,
  });

  const errors = result.filter((r) => !r.pass && r.severity === "error");
  if (errors.length > 0) {
    return { ok: false, code: "guardrail-failed", issues: errors };
  }

  // Compute embedding for duplicate detection
  const embedding = await computeEmbedding(post.mdxBody);

  const rows = await db
    .update(posts)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
      embedding: embedding,
    })
    .where(eq(posts.id, id))
    .returning();

  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to publish post", 500);
  return { ok: true, post: row };
}

export async function unpublishPost(id: string, siteId: string): Promise<Post> {
  await getPost(id, siteId);
  const rows = await db
    .update(posts)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to unpublish post", 500);
  return row;
}

export async function schedulePost(
  id: string,
  siteId: string,
  scheduledAt: Date
): Promise<Post> {
  await getPost(id, siteId);
  const rows = await db
    .update(posts)
    .set({ status: "scheduled", scheduledAt, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to schedule post", 500);
  return row;
}

export async function deletePost(id: string, siteId: string): Promise<void> {
  await getPost(id, siteId);
  await db.delete(posts).where(eq(posts.id, id));
}

export async function getPublishedPostsForSitemap(
  siteId: string
): Promise<Array<{ slug: string; updatedAt: Date; coverMediaId: string | null }>> {
  return db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt, coverMediaId: posts.coverMediaId })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.status, "published")));
}
