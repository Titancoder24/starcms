export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { sites, posts, pages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) return new Response("No site configured", { status: 404 });

  const baseUrl = site.domain ? `https://${site.domain}` : process.env["NEXT_PUBLIC_BASE_URL"] ?? "";

  const [publishedPosts, publishedPages] = await Promise.all([
    db.select().from(posts).where(and(eq(posts.siteId, site.id), eq(posts.status, "published"))).limit(100),
    db.select().from(pages).where(and(eq(pages.siteId, site.id), eq(pages.status, "published"))).limit(50),
  ]);

  let txt = `# ${site.name}

> A content site powered by StarCMS.

${publishedPages.length > 0 ? "## Pages\n" : ""}
${publishedPages.map((p) => `- [${p.title}](${baseUrl}/${p.slug}): ${p.excerpt ?? p.metaDescription ?? ""}`).join("\n")}

## Posts

${publishedPosts.map((p) => `- [${p.title}](${baseUrl}/p/${p.slug}): ${p.excerpt ?? p.metaDescription ?? ""}`).join("\n")}
`;

  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "s-maxage=3600" },
  });
}
