export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { sites } from "@/lib/db/schema";

export async function GET() {
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];
  const baseUrl = site?.domain
    ? `https://${site.domain}`
    : process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  const rc = site?.settings?.robotsConfig;

  const disallows: string[] = [];
  if (rc?.disallowGptBot) disallows.push("User-agent: GPTBot\nDisallow: /");
  if (rc?.disallowClaudeBot) disallows.push("User-agent: ClaudeBot\nDisallow: /");
  if (rc?.disallowGoogleExtended) disallows.push("User-agent: Google-Extended\nDisallow: /");
  if (rc?.disallowPerplexityBot) disallows.push("User-agent: PerplexityBot\nDisallow: /");
  if (rc?.disallowCCBot) disallows.push("User-agent: CCBot\nDisallow: /");
  if (rc?.disallowBytespider) disallows.push("User-agent: Bytespider\nDisallow: /");

  const txt = `# StarCMS robots.txt
User-agent: *
Disallow: /admin/
Disallow: /api/

# AI crawlers — explicitly allowed by default
User-agent: GPTBot
${rc?.disallowGptBot ? "Disallow: /" : "Allow: /"}

User-agent: ClaudeBot
${rc?.disallowClaudeBot ? "Disallow: /" : "Allow: /"}

User-agent: Google-Extended
${rc?.disallowGoogleExtended ? "Disallow: /" : "Allow: /"}

User-agent: PerplexityBot
${rc?.disallowPerplexityBot ? "Disallow: /" : "Allow: /"}

User-agent: CCBot
${rc?.disallowCCBot ? "Disallow: /" : "Allow: /"}

User-agent: Bytespider
${rc?.disallowBytespider ? "Disallow: /" : "Allow: /"}

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(txt, {
    headers: { "Content-Type": "text/plain", "Cache-Control": "s-maxage=3600" },
  });
}
