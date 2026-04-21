/**
 * Lightweight web crawler / structured-data extractor.
 * Used to feed programmatic templates with real competitor or reference data.
 * Follows robots.txt (checks Disallow rules before fetching).
 */

export interface CrawlResult {
  url: string;
  title: string;
  description: string;
  h1: string;
  h2s: string[];
  wordCount: number;
  links: Array<{ href: string; text: string }>;
  structuredData: unknown[];
  ogTags: Record<string, string>;
  canonicalUrl: string | null;
  statusCode: number;
  crawledAt: string;
}

export interface CrawlOptions {
  /** Follow and check robots.txt before crawling. Default true. */
  respectRobots?: boolean;
  /** Maximum number of external links to follow. Default 0 (current page only). */
  followLinks?: number;
  /** Request timeout in ms. Default 10000. */
  timeoutMs?: number;
}

/**
 * Extract text content between two HTML tags (very lightweight, no full HTML parser dependency).
 */
function extractTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return re.exec(html)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
}

function extractAllTags(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = match[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    if (text) results.push(text);
  }
  return results;
}

function extractMeta(html: string, nameOrProp: string): string {
  const byName = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']+)["']`,
    "i"
  ).exec(html);
  const byContent = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${nameOrProp}["']`,
    "i"
  ).exec(html);
  return byName?.[1] ?? byContent?.[1] ?? "";
}

function extractLinks(html: string, baseUrl: string): Array<{ href: string; text: string }> {
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)/gi;
  const links: Array<{ href: string; text: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const href = new URL(match[1] ?? "", baseUrl).href;
      const text = (match[2] ?? "").trim();
      if (text) links.push({ href, text });
    } catch {
      // ignore relative/malformed
    }
  }
  return links;
}

function extractStructuredData(html: string): unknown[] {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const results: unknown[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1] ?? "{}"));
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return results;
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.split(" ").filter(Boolean).length;
}

async function checkRobots(baseUrl: string, userAgent = "StarCMSBot"): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return true; // no robots.txt = allowed
    const text = await res.text();
    let inOurBlock = false;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (/^user-agent:\s*\*/i.test(trimmed) || new RegExp(`^user-agent:\\s*${userAgent}`, "i").test(trimmed)) {
        inOurBlock = true;
      } else if (/^user-agent:/i.test(trimmed)) {
        inOurBlock = false;
      }
      if (inOurBlock && /^disallow:\s*\//i.test(trimmed)) {
        const disallowedPath = trimmed.replace(/^disallow:\s*/i, "");
        const targetPath = new URL(baseUrl).pathname;
        if (targetPath.startsWith(disallowedPath)) return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Crawl a single URL and extract structured data.
 */
export async function crawlUrl(
  url: string,
  opts: CrawlOptions = {}
): Promise<CrawlResult> {
  const { respectRobots = true, timeoutMs = 10000 } = opts;

  if (respectRobots) {
    const allowed = await checkRobots(url);
    if (!allowed) {
      return {
        url,
        title: "",
        description: "",
        h1: "",
        h2s: [],
        wordCount: 0,
        links: [],
        structuredData: [],
        ogTags: {},
        canonicalUrl: null,
        statusCode: 0,
        crawledAt: new Date().toISOString(),
      };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let html = "";
  let statusCode = 0;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "StarCMSBot/1.0 (+https://github.com/starcms)" },
    });
    statusCode = res.status;
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const ogTags: Record<string, string> = {};
  for (const prop of ["og:title", "og:description", "og:image", "og:type", "og:url"]) {
    const val = extractMeta(html, prop);
    if (val) ogTags[prop] = val;
  }

  const canonicalMatch = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  const canonicalUrl = canonicalMatch?.[1] ?? null;

  return {
    url,
    title: extractTag(html, "title"),
    description: extractMeta(html, "description") || extractMeta(html, "og:description"),
    h1: extractAllTags(html, "h1")[0] ?? "",
    h2s: extractAllTags(html, "h2"),
    wordCount: countWords(html),
    links: extractLinks(html, url),
    structuredData: extractStructuredData(html),
    ogTags,
    canonicalUrl,
    statusCode,
    crawledAt: new Date().toISOString(),
  };
}

/**
 * Crawl multiple URLs in parallel (max 5 concurrent).
 */
export async function crawlBatch(
  urls: string[],
  opts: CrawlOptions = {}
): Promise<CrawlResult[]> {
  const CONCURRENCY = 5;
  const results: CrawlResult[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((u) => crawlUrl(u, opts)));
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
}
