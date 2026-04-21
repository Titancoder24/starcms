import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { authors, posts, sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) return {};
  const author = await db.query.authors.findFirst({
    where: (a) => and(eq(a.siteId, site.id), eq(a.slug, slug)),
  });
  if (!author) return {};
  return { title: author.name, description: author.bio ?? "" };
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) notFound();

  const author = await db.query.authors.findFirst({
    where: (a) => and(eq(a.siteId, site.id), eq(a.slug, slug)),
  });
  if (!author) notFound();

  const authorPosts = await db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.authorId, author.id), eq(posts.status, "published")));

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-16">
      <header className="mb-12">
        <h1 className="text-3xl font-bold mb-2">{author.name}</h1>
        {author.bio && <p className="text-[var(--color-text-muted)] max-w-prose">{author.bio}</p>}
        {author.credentials && <p className="text-sm text-[var(--color-text-muted)] mt-2">{author.credentials}</p>}
      </header>
      <div className="space-y-4">
        {authorPosts.map((post) => (
          <div key={post.id} className="border-b border-[var(--color-border)] pb-4">
            <Link href={`/p/${post.slug}`} className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]">
              {post.title}
            </Link>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{post.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
