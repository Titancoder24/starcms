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

  const entries = recentPosts
    .map(
      (p) => `  <entry>
    <title><![CDATA[${p.title}]]></title>
    <link href="${baseUrl}/p/${p.slug}"/>
    <id>${baseUrl}/p/${p.slug}</id>
    <updated>${p.updatedAt.toISOString()}</updated>
    <published>${p.publishedAt?.toISOString() ?? p.createdAt.toISOString()}</published>
    <summary><![CDATA[${p.excerpt ?? p.metaDescription ?? ""}]]></summary>
    <content type="html"><![CDATA[${p.mdxBody}]]></content>
  </entry>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${site.name}</title>
  <link href="${baseUrl}" rel="alternate"/>
  <link href="${baseUrl}/atom.xml" rel="self"/>
  <id>${baseUrl}/</id>
  <updated>${new Date().toISOString()}</updated>
${entries}
</feed>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "s-maxage=3600" },
  });
}
