import type { Metadata } from "next";
import type { Post, Page, Site } from "@/lib/db/schema";

export function buildPostMetadata(
  post: Post,
  site: Site,
  baseUrl: string
): Metadata {
  const title = post.metaTitle ?? post.title;
  const description = post.metaDescription ?? post.excerpt ?? "";
  const url = `${baseUrl}/p/${post.slug}`;
  const canonical = post.canonical ?? url;
  const ogImage = post.seo?.openGraphImage;

  return {
    title,
    description,
    alternates: { canonical },
    robots:
      post.seo?.noIndex || post.seo?.noFollow
        ? {
            index: !post.seo.noIndex,
            follow: !post.seo.noFollow,
          }
        : undefined,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: site.name,
    },
    twitter: {
      card: post.seo?.twitterCardType ?? "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export function buildPageMetadata(
  page: Page,
  site: Site,
  baseUrl: string
): Metadata {
  const title = page.metaTitle ?? page.title;
  const description = page.metaDescription ?? page.excerpt ?? "";
  const url = `${baseUrl}/${page.slug}`;
  const canonical = page.canonical ?? url;

  return {
    title,
    description,
    alternates: { canonical },
    robots:
      page.seo?.noIndex || page.seo?.noFollow
        ? { index: !page.seo.noIndex, follow: !page.seo.noFollow }
        : undefined,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: site.name,
      images: page.seo?.openGraphImage ? [{ url: page.seo.openGraphImage }] : undefined,
    },
    twitter: {
      card: page.seo?.twitterCardType ?? "summary_large_image",
      title,
      description,
    },
  };
}
