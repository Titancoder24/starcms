"use server";

import { auth } from "@/lib/auth/config";
import { createPost, updatePost, publishPost, getPost } from "@/lib/api/posts";
import { runGuardrails } from "@/lib/guardrails";
import { db } from "@/lib/db/client";
import { posts, sites, authors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { isApiError } from "@/lib/api/errors";
import type { GuardResult } from "@/lib/guardrails/types";

type SaveInput = {
  id?: string;
  siteId: string;
  title: string;
  slug: string;
  mdxBody: string;
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  authorId?: string;
  tagIds?: string[];
  categoryIds?: string[];
};

export async function savePost(
  input: SaveInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  try {
    if (input.id) {
      const post = await updatePost(input.id, input.siteId, input);
      return { ok: true, id: post.id };
    } else {
      const post = await createPost(input.siteId, input);
      return { ok: true, id: post.id };
    }
  } catch (err) {
    return {
      ok: false,
      error: isApiError(err) ? err.message : "Failed to save post",
    };
  }
}

export async function publishPostAction(
  id: string,
  siteId: string
): Promise<
  | { ok: true }
  | { ok: false; issues?: GuardResult[]; error?: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  try {
    const result = await publishPost(id, siteId);
    if (result.ok) return { ok: true };
    return { ok: false, issues: result.issues as GuardResult[] };
  } catch (err) {
    return {
      ok: false,
      error: isApiError(err) ? err.message : "Failed to publish",
    };
  }
}

export async function runGuardrailsAction(
  postId: string,
  siteId: string
): Promise<GuardResult[] | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const post = await db.query.posts.findFirst({
    where: (p) => and(eq(p.id, postId), eq(p.siteId, siteId)),
  });
  if (!post) return null;

  const site = await db.query.sites.findFirst({ where: (s) => eq(s.id, siteId) });
  const author = post.authorId
    ? await db.query.authors.findFirst({ where: (a) => eq(a.id, post.authorId!) })
    : undefined;

  const allPublished = await db
    .select({ id: posts.id, embedding: posts.embedding })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.status, "published")));

  const publishedPosts = await db
    .select({ id: posts.id, slug: posts.slug, mdxBody: posts.mdxBody })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.status, "published")));

  return runGuardrails({
    post,
    site: site ?? null,
    author: author ?? null,
    allPublishedPosts: allPublished,
    publishedPosts,
  });
}
