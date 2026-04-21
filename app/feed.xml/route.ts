export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { sites, posts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) return new Response("No site configured", { status: 404 });

  const baseUrl = site.domain ? `https://${site.domain}` : process.env["NEXT_PUBLIC_BASE_URL"] ?? "";
  const recentPosts = await db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt))
    .limit(20);

  const items = recentPosts
    .map(
      (p) => `    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${baseUrl}/p/${p.slug}</link>
      <guid isPermaLink="true">${baseUrl}/p/${p.slug}</guid>
      <pubDate>${p.publishedAt?.toUTCString() ?? ""}</pubDate>
      <description><![CDATA[${p.excerpt ?? p.metaDescription ?? ""}]]></description>
      <content:encoded><![CDATA[${p.mdxBody}]]></content:encoded>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${site.name}]]></title>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <description><![CDATA[${site.name} RSS Feed]]></description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "s-maxage=3600" },
  });
}
