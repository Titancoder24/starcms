import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL required");
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

export async function crawlAllSites() {
  // Dynamically import schema to avoid build-time issues
  const { sites, posts, pages, auditRuns } = await import("../../lib/db/schema.js");
  const { runAudit } = await import("../../lib/audit/orchestrator.js");

  const allSites = await db.select().from(sites);
  for (const site of allSites) {
    const baseUrl = site.domain ? `https://${site.domain}` : "";
    if (!baseUrl) continue;

    const [publishedPosts, publishedPages] = await Promise.all([
      db.select().from(posts).where(eq(posts.siteId, site.id)),
      db.select().from(pages).where(eq(pages.siteId, site.id)),
    ]);

    const urls = [
      ...publishedPosts.map((p) => ({ url: `${baseUrl}/p/${p.slug}`, postId: p.id, pageId: undefined })),
      ...publishedPages.map((p) => ({ url: `${baseUrl}/${p.slug}`, postId: undefined, pageId: p.id })),
    ];

    for (const { url, postId, pageId } of urls) {
      try {
        await runAudit({ url, siteId: site.id, postId, pageId, source: "cron" });
        // Throttle to avoid overwhelming external APIs
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`Audit failed for ${url}:`, err);
      }
    }
  }
}
