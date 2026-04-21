import { db } from "@/lib/db/client";
import { media, type Media } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ApiError } from "./errors";

export async function listMedia(
  siteId: string,
  limit = 50,
  offset = 0
): Promise<{ items: Media[]; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(media)
    .where(eq(media.siteId, siteId))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(media.createdAt);
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit), hasMore };
}

export async function getMedia(id: string, siteId: string): Promise<Media> {
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.siteId, siteId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Media not found", 404);
  return row;
}

export async function createMediaRecord(
  siteId: string,
  data: {
    url: string;
    blobKey: string;
    alt: string;
    width?: number;
    height?: number;
    format?: string;
    sizeBytes?: number;
    blurhash?: string;
    variants?: Array<{ width: number; height: number; url: string; format: string }>;
  }
): Promise<Media> {
  const rows = await db.insert(media).values({ siteId, ...data }).returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create media record", 500);
  return row;
}

export async function updateMediaAlt(
  id: string,
  siteId: string,
  alt: string
): Promise<Media> {
  await getMedia(id, siteId);
  const rows = await db
    .update(media)
    .set({ alt })
    .where(eq(media.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to update media", 500);
  return row;
}

export async function deleteMedia(id: string, siteId: string): Promise<string> {
  const item = await getMedia(id, siteId);
  await db.delete(media).where(eq(media.id, id));
  return item.blobKey;
}
