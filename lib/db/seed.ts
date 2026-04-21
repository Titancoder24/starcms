import { db } from "./client";
import {
  users,
  sites,
  authors,
  posts,
  pages,
  tags,
  categories,
  postTags,
} from "./schema";
import { eq, and } from "drizzle-orm";
import { slugify } from "@/lib/util/slugify";

async function seed() {
  console.log("Seeding database...");

  // Idempotent: check if seed data exists
  const existing = await db.select().from(sites).where(eq(sites.slug, "demo-site")).limit(1);
  if (existing[0]) {
    console.log("Seed data already exists, skipping.");
    return;
  }

  // Create demo user
  const userRows = await db
    .insert(users)
    .values({
      email: "demo@starcms.dev",
      name: "Demo User",
      role: "owner",
    })
    .returning();
  const user = userRows[0]!;

  // Create demo site
  const siteRows = await db
    .insert(sites)
    .values({
      ownerId: user.id,
      name: "Demo Site",
      slug: "demo-site",
      domain: "demo.starcms.dev",
      settings: {
        organization: {
          legalName: "Demo Company Inc.",
          sameAs: ["https://twitter.com/demo", "https://linkedin.com/company/demo"],
        },
      },
    })
    .returning();
  const site = siteRows[0]!;

  // Create author with E-E-A-T fields
  const authorRows = await db
    .insert(authors)
    .values({
      siteId: site.id,
      name: "Dr. Jane Smith",
      slug: "jane-smith",
      bio: "Dr. Jane Smith is a content strategist with 12 years of experience in digital marketing and SEO. She holds a PhD in Communications from MIT.",
      credentials: "PhD Communications, MIT. 12 years experience. Author of 'Content That Ranks' (2023).",
      expertise: ["SEO", "Content Strategy", "Digital Marketing", "Technical Writing"],
      socialLinks: {
        twitter: "https://twitter.com/janesmith",
        linkedin: "https://linkedin.com/in/janesmith",
        website: "https://janesmith.com",
      },
    })
    .returning();
  const author = authorRows[0]!;

  // Create tags
  const tagData = [
    { name: "SEO", slug: "seo" },
    { name: "Content Marketing", slug: "content-marketing" },
    { name: "Technical SEO", slug: "technical-seo" },
    { name: "Link Building", slug: "link-building" },
    { name: "Analytics", slug: "analytics" },
  ];

  const tagRows = await db
    .insert(tags)
    .values(tagData.map((t) => ({ ...t, siteId: site.id })))
    .returning();

  // Create categories
  await db.insert(categories).values([
    { siteId: site.id, name: "Guides", slug: "guides" },
    { siteId: site.id, name: "Case Studies", slug: "case-studies" },
  ]);

  // Create three demo posts (covering different topics for internal-link testing)
  const post1Rows = await db
    .insert(posts)
    .values({
      siteId: site.id,
      authorId: author.id,
      slug: "complete-guide-to-technical-seo",
      title: "The Complete Guide to Technical SEO in 2026",
      metaTitle: "Technical SEO Guide 2026: The Complete Reference",
      metaDescription: "Master technical SEO with this comprehensive guide covering Core Web Vitals, crawlability, schema markup, and the latest algorithm updates for 2026.",
      excerpt: "Everything you need to know about technical SEO, from Core Web Vitals to structured data and crawl optimization.",
      mdxBody: `## What Is Technical SEO?

Technical SEO refers to the process of optimizing your website for the crawling and indexing phase of search engine optimization. Unlike [on-page SEO](/p/on-page-seo-guide) and [link building strategies](/p/link-building-strategies-2026), technical SEO focuses on the infrastructure of your site.

## Core Web Vitals in 2026

Core Web Vitals are a set of specific factors that Google considers important in a webpage's overall user experience. The three main metrics are:

- **LCP (Largest Contentful Paint)**: Measures loading performance. Should occur within 2.5 seconds.
- **INP (Interaction to Next Paint)**: Measures interactivity. Should be below 200ms.
- **CLS (Cumulative Layout Shift)**: Measures visual stability. Should be less than 0.1.

## Structured Data and Schema Markup

Implementing structured data helps search engines understand your content better. The most impactful schema types include Article, FAQ, HowTo, and Product.

## Crawl Budget Optimization

Every website has a crawl budget — the number of pages Googlebot will crawl in a given timeframe. Optimize your crawl budget by fixing broken links, using proper redirects, and keeping your sitemap updated.

## Mobile-First Indexing

Google uses the mobile version of your site for indexing and ranking. Ensure your mobile site has the same content, structured data, and metadata as your desktop version.

## Conclusion

Technical SEO is the foundation of any successful search strategy. By addressing crawlability, page speed, structured data, and mobile optimization, you create the best possible conditions for your content to rank.`,
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const post1 = post1Rows[0]!;

  const post2Rows = await db
    .insert(posts)
    .values({
      siteId: site.id,
      authorId: author.id,
      slug: "on-page-seo-guide",
      title: "On-Page SEO: Everything That Actually Moves the Needle",
      metaTitle: "On-Page SEO Guide: Factors That Actually Rank Pages",
      metaDescription: "Learn the on-page SEO factors that directly influence rankings: title tags, meta descriptions, heading structure, content quality, and internal linking.",
      excerpt: "A practical guide to on-page SEO that covers the factors search engines actually reward.",
      mdxBody: `## What Is On-Page SEO?

On-page SEO refers to all the optimizations you make directly on a webpage to improve its search engine rankings. This complements [technical SEO](/p/complete-guide-to-technical-seo) and your [link building efforts](/p/link-building-strategies-2026).

## Title Tags and Meta Descriptions

Your title tag is one of the most important on-page factors. Keep it between 30–60 characters, include your primary keyword, and make it compelling for searchers.

Meta descriptions don't directly influence rankings, but they affect click-through rates. Write them between 120–160 characters with a clear value proposition.

## Heading Structure

Use a logical heading hierarchy. Your H1 should contain your primary keyword and appear once per page. H2s cover major sections; H3s cover sub-topics within sections.

## Content Quality and E-E-A-T

Google evaluates Experience, Expertise, Authoritativeness, and Trustworthiness (E-E-A-T). Demonstrate expertise by citing sources, including author credentials, and providing genuinely helpful, accurate information.

## Internal Linking

Internal links distribute page authority throughout your site and help users discover related content. Link to relevant pages with descriptive anchor text that includes keywords.

## Image Optimization

Every image should have descriptive alt text. Use modern formats like WebP and AVIF. Specify width and height attributes to prevent layout shift.`,
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const post2 = post2Rows[0]!;

  const post3Rows = await db
    .insert(posts)
    .values({
      siteId: site.id,
      authorId: author.id,
      slug: "link-building-strategies-2026",
      title: "Link Building Strategies That Work in 2026",
      metaTitle: "Link Building in 2026: Strategies That Actually Work",
      metaDescription: "Discover link building strategies that build real authority: digital PR, original research, resource pages, and broken link reclamation for 2026.",
      excerpt: "Evidence-based link building strategies that earn high-quality backlinks without risking penalties.",
      mdxBody: `## Why Link Building Still Matters

Backlinks remain one of the most powerful ranking signals. Combined with strong [on-page SEO](/p/on-page-seo-guide) and solid [technical foundations](/p/complete-guide-to-technical-seo), quality links can propel pages to the top of search results.

## Digital PR: The Highest-Leverage Strategy

Create newsworthy content — original research, surveys, data studies — that journalists want to cite. A single data study can earn hundreds of links from major publications.

## The Skyscraper Technique

Find high-ranking content in your niche, create something substantially better, then reach out to sites linking to the original. Success depends on the quality gap you create.

## Resource Page Link Building

Resource pages are pages that link to the best tools and guides on a topic. Find relevant resource pages, create genuinely useful content, and email the curator a short pitch.

## Broken Link Reclamation

Find broken external links on authoritative pages in your niche. Create or identify existing content that would serve as a replacement, then email the site owner with a friendly heads-up.

## What Not to Do

Never buy links, participate in private blog networks, or use automated link building software. These tactics risk Google penalties that can erase years of work overnight.`,
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const post3 = post3Rows[0]!;

  // Tag posts
  const seoTag = tagRows.find((t) => t.slug === "seo")!;
  const techSeoTag = tagRows.find((t) => t.slug === "technical-seo")!;
  const contentTag = tagRows.find((t) => t.slug === "content-marketing")!;

  await db.insert(postTags).values([
    { postId: post1.id, tagId: seoTag.id },
    { postId: post1.id, tagId: techSeoTag.id },
    { postId: post2.id, tagId: seoTag.id },
    { postId: post2.id, tagId: contentTag.id },
    { postId: post3.id, tagId: seoTag.id },
  ]);

  // Create an About page
  await db.insert(pages).values({
    siteId: site.id,
    slug: "about",
    title: "About This Site",
    metaTitle: "About Demo Site — Built with StarCMS",
    metaDescription: "Demo Site is a content publication built with StarCMS, the SEO-first CMS with pre-publish guardrails and MCP-native AI integration.",
    excerpt: "Learn about this site and how it was built.",
    mdxBody: "## About Demo Site\n\nThis site is built with StarCMS — the CMS built to rank. Every post passes our pre-publish guardrails before going live, and is continuously audited for SEO health.",
    status: "published",
    publishedAt: new Date(),
  });

  console.log("✓ Seed complete:");
  console.log(`  - Site: ${site.name} (${site.slug})`);
  console.log(`  - Author: ${author.name}`);
  console.log(`  - Posts: 3 published`);
  console.log(`  - Tags: ${tagData.length}`);
  console.log(`  - Pages: 1`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
