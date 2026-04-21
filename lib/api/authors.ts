import { db } from "@/lib/db/client";
import { authors, type Author, type NewAuthor } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { ApiError } from "./errors";
import { slugify } from "@/lib/util/slugify";

export const AuthorInputSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).optional(),
  credentials: z.string().max(2000).optional(),
  expertise: z.array(z.string()).optional(),
  image: z.string().url().optional(),
  socialLinks: z
    .object({
      twitter: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      mastodon: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});

export type AuthorInput = z.infer<typeof AuthorInputSchema>;

export async function listAuthors(siteId: string): Promise<Author[]> {
  return db.select().from(authors).where(eq(authors.siteId, siteId));
}

export async function getAuthor(id: string, siteId: string): Promise<Author> {
  const rows = await db
    .select()
    .from(authors)
    .where(and(eq(authors.id, id), eq(authors.siteId, siteId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not-found", "Author not found", 404);
  return row;
}

export async function createAuthor(
  siteId: string,
  input: AuthorInput
): Promise<Author> {
  const slug = input.slug ?? slugify(input.name);
  const rows = await db
    .insert(authors)
    .values({ siteId, ...input, slug })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create author", 500);
  return row;
}

export async function updateAuthor(
  id: string,
  siteId: string,
  input: Partial<AuthorInput>
): Promise<Author> {
  await getAuthor(id, siteId);
  const rows = await db
    .update(authors)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(authors.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to update author", 500);
  return row;
}

export async function deleteAuthor(id: string, siteId: string): Promise<void> {
  await getAuthor(id, siteId);
  await db.delete(authors).where(eq(authors.id, id));
}
