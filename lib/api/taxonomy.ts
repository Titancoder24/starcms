import { db } from "@/lib/db/client";
import {
  tags,
  categories,
  postTags,
  postCategories,
  type Tag,
  type Category,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { ApiError } from "./errors";
import { slugify } from "@/lib/util/slugify";

export async function listTags(siteId: string): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.siteId, siteId));
}

export async function createTag(
  siteId: string,
  input: { name: string; slug?: string }
): Promise<Tag> {
  const slug = input.slug ?? slugify(input.name);
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.siteId, siteId), eq(tags.slug, slug)))
    .limit(1);
  if (existing[0]) throw new ApiError("conflict", "Tag slug already exists", 409);
  const rows = await db.insert(tags).values({ siteId, name: input.name, slug }).returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create tag", 500);
  return row;
}

export async function deleteTag(id: string, siteId: string): Promise<void> {
  const rows = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.siteId, siteId)))
    .limit(1);
  if (!rows[0]) throw new ApiError("not-found", "Tag not found", 404);
  await db.delete(tags).where(eq(tags.id, id));
}

export async function listCategories(siteId: string): Promise<Category[]> {
  return db.select().from(categories).where(eq(categories.siteId, siteId));
}

export async function createCategory(
  siteId: string,
  input: { name: string; slug?: string; parentId?: string }
): Promise<Category> {
  const slug = input.slug ?? slugify(input.name);
  const existing = await db
    .select()
    .from(categories)
    .where(and(eq(categories.siteId, siteId), eq(categories.slug, slug)))
    .limit(1);
  if (existing[0]) throw new ApiError("conflict", "Category slug already exists", 409);
  const rows = await db
    .insert(categories)
    .values({ siteId, name: input.name, slug, parentId: input.parentId })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create category", 500);
  return row;
}

export async function getTagsForPost(postId: string): Promise<Tag[]> {
  const rows = await db
    .select({ tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, postId));
  return rows.map((r) => r.tag);
}

export async function setTagsForPost(
  postId: string,
  tagIds: string[]
): Promise<void> {
  await db.delete(postTags).where(eq(postTags.postId, postId));
  if (tagIds.length > 0) {
    await db
      .insert(postTags)
      .values(tagIds.map((tagId) => ({ postId, tagId })));
  }
}

export async function setCategoriesForPost(
  postId: string,
  categoryIds: string[]
): Promise<void> {
  await db.delete(postCategories).where(eq(postCategories.postId, postId));
  if (categoryIds.length > 0) {
    await db
      .insert(postCategories)
      .values(categoryIds.map((categoryId) => ({ postId, categoryId })));
  }
}
