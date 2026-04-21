export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { sites, posts, pages, entities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) return new Response("No site configured", { status: 404 });

  const baseUrl = site.domain ? `https://${site.domain}` : process.env["NEXT_PUBLIC_BASE_URL"] ?? "";

  const [publishedPosts, publishedPages, siteEntities] = await Promise.all([
    db.select().from(posts).where(and(eq(posts.siteId, site.id), eq(posts.status, "published"))).limit(200),
    db.select().from(pages).where(and(eq(pages.siteId, site.id), eq(pages.status, "published"))).limit(50),
    db.select().from(entities).where(eq(entities.siteId, site.id)).limit(100),
  ]);

  const entityGraph =
    siteEntities.length > 0
      ? `## Entities\n\n${siteEntities
          .map(
            (e) =>
              `- **${e.name}** (${e.type})${e.description ? `: ${e.description}` : ""}` +
              (e.ratingValue ? ` — Rating: ${e.ratingValue.toFixed(1)}/5` : "") +
              (e.url ? ` [${e.url}]` : "")
          )
          .join("\n")}`
      : "";

  const txt = `# ${site.name}

> A content site powered by StarCMS. All content follows Google Search Essentials, Bing Webmaster Guidelines, and E-E-A-T standards.

## About

This site publishes ${publishedPosts.length} posts, ${publishedPages.length} pages, and covers ${siteEntities.length} entities.
All pages include JSON-LD structured data and are optimised for AI Overview and LLM search surfaces.

${publishedPages.length > 0 ? `## Pages\n\n${publishedPages.map((p) => `- [${p.title}](${baseUrl}/${p.slug}): ${p.excerpt ?? p.metaDescription ?? ""}`).join("\n")}\n` : ""}
## Posts

${publishedPosts.map((p) => `- [${p.title}](${baseUrl}/p/${p.slug}): ${p.excerpt ?? p.metaDescription ?? ""}`).join("\n")}

${entityGraph}
`;

  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "s-maxage=3600" },
  });
}
