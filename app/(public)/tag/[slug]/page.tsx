import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { tags, posts, postTags, sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `#${slug}` };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) notFound();

  const tag = await db.query.tags.findFirst({
    where: (t) => and(eq(t.siteId, site.id), eq(t.slug, slug)),
  });
  if (!tag) notFound();

  const taggedPosts = await db
    .select({ post: posts })
    .from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .where(and(eq(postTags.tagId, tag.id), eq(posts.status, "published")));

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-16">
      <header className="mb-12">
        <h1 className="text-3xl font-bold">#{tag.name}</h1>
        <p className="text-[var(--color-text-muted)] mt-2">{taggedPosts.length} posts</p>
      </header>
      <div className="space-y-4">
        {taggedPosts.map(({ post }) => (
          <div key={post.id} className="border-b border-[var(--color-border)] pb-4">
            <Link href={`/p/${post.slug}`} className="font-semibold hover:text-[var(--color-accent)]">
              {post.title}
            </Link>
            {post.excerpt && <p className="text-sm text-[var(--color-text-muted)] mt-1">{post.excerpt}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
