export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { sites, posts, pages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  // Get first site (single-tenant mode)
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  if (!site) return new Response("No site configured", { status: 404 });

  const baseUrl = site.domain ? `https://${site.domain}` : process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  const [publishedPosts, publishedPages] = await Promise.all([
    db.select().from(posts).where(and(eq(posts.siteId, site.id), eq(posts.status, "published"))),
    db.select().from(pages).where(and(eq(pages.siteId, site.id), eq(pages.status, "published"))),
  ]);

  const allUrls = [
    { loc: baseUrl, lastmod: new Date().toISOString() },
    ...publishedPosts.map((p) => ({
      loc: `${baseUrl}/p/${p.slug}`,
      lastmod: p.updatedAt.toISOString(),
    })),
    ...publishedPages.map((p) => ({
      loc: `${baseUrl}/${p.slug}`,
      lastmod: p.updatedAt.toISOString(),
    })),
  ];

  // Use sitemap index for large sites
  if (allUrls.length > 10000) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-posts.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-pages.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;
    return new Response(xml, {
      headers: { "Content-Type": "application/xml", "Cache-Control": "s-maxage=3600" },
    });
  }

  const urlEntries = allUrls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "s-maxage=3600" },
  });
}
