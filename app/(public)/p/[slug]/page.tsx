import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { posts, sites, authors, media } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { Metadata } from "next";
import { buildPostMetadata } from "@/lib/seo/meta";
import { generateSchemaForPost } from "@/lib/schema-ld";
import Image from "next/image";

type Props = { params: Promise<{ slug: string }> };

async function getPostData(slug: string) {
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) return null;

  const postRows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.slug, slug), eq(posts.status, "published")))
    .limit(1);
  const post = postRows[0];
  if (!post) return null;

  const author = post.authorId
    ? await db.query.authors.findFirst({ where: (a) => eq(a.id, post.authorId!) })
    : undefined;

  const coverMedia = post.coverMediaId
    ? await db.query.media.findFirst({ where: (m) => eq(m.id, post.coverMediaId!) })
    : undefined;

  return { post, site, author, coverMedia };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPostData(slug);
  if (!data) return {};
  const baseUrl = data.site.domain ? `https://${data.site.domain}` : process.env["NEXT_PUBLIC_BASE_URL"] ?? "";
  return buildPostMetadata(data.post, data.site, baseUrl);
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPostData(slug);
  if (!data) notFound();

  const { post, site, author, coverMedia } = data;
  const baseUrl = site.domain ? `https://${site.domain}` : process.env["NEXT_PUBLIC_BASE_URL"] ?? "";
  const schema = generateSchemaForPost(post, site, author);

  const variants = (coverMedia?.variants ?? []) as Array<{ width: number; height: number; url: string; format: string }>;
  const avifVariants = variants.filter((v) => v.format === "avif");
  const webpVariants = variants.filter((v) => v.format === "webp");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article className="max-w-[var(--prose-max-width)] mx-auto px-4 py-16">
        {coverMedia && (
          <figure className="mb-10 -mx-4 sm:mx-0 sm:rounded-[var(--radius-lg)] overflow-hidden">
            <picture>
              {avifVariants.length > 0 && (
                <source
                  type="image/avif"
                  srcSet={avifVariants.map((v) => `${v.url} ${v.width}w`).join(", ")}
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              )}
              {webpVariants.length > 0 && (
                <source
                  type="image/webp"
                  srcSet={webpVariants.map((v) => `${v.url} ${v.width}w`).join(", ")}
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              )}
              <img
                src={coverMedia.url}
                alt={coverMedia.alt}
                width={coverMedia.width ?? 1280}
                height={coverMedia.height ?? 720}
                className="w-full h-auto"
                loading="eager"
                decoding="sync"
                style={
                  coverMedia.blurhash
                    ? { backgroundImage: `url(${coverMedia.blurhash})`, backgroundSize: "cover" }
                    : undefined
                }
              />
            </picture>
          </figure>
        )}

        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] leading-[var(--lh-heading)] mb-4">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-xl text-[var(--color-text-muted)] font-serif leading-relaxed">
              {post.excerpt}
            </p>
          )}
          {(author || post.publishedAt) && (
            <div className="flex items-center gap-4 mt-6 text-sm text-[var(--color-text-muted)]">
              {author && (
                <span className="font-medium text-[var(--color-text)]">{author.name}</span>
              )}
              {post.publishedAt && (
                <time dateTime={post.publishedAt.toISOString()}>
                  {post.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </time>
              )}
            </div>
          )}
        </header>

        <div
          className="prose-body"
          dangerouslySetInnerHTML={{ __html: post.mdxBody }}
        />

        {author && (
          <footer className="mt-16 pt-8 border-t border-[var(--color-border)]">
            <div className="flex items-start gap-4">
              {author.image && (
                <Image
                  src={author.image}
                  alt={author.name}
                  width={48}
                  height={48}
                  className="rounded-full shrink-0"
                />
              )}
              <div>
                <p className="font-semibold text-[var(--color-text)]">{author.name}</p>
                {author.bio && (
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">{author.bio}</p>
                )}
              </div>
            </div>
          </footer>
        )}
      </article>
    </>
  );
}
