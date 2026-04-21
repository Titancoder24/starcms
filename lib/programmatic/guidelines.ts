/**
 * SEO Guidelines compliance checker.
 *
 * Validates content and page metadata against:
 * - Google Search Essentials (Webmaster Guidelines)
 * - Bing Webmaster Guidelines
 * - Core Web Vitals hints
 * - E-E-A-T signals
 * - AI-generated content disclosure requirements
 *
 * Returns a structured compliance report, not a pass/fail.
 */

export type Severity = "error" | "warning" | "info";

export interface GuidelineResult {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  guidelineSource: "google" | "bing" | "eeat" | "aia";
  pass: boolean;
}

export interface ComplianceReport {
  score: number; // 0–100
  results: GuidelineResult[];
  passCount: number;
  warnCount: number;
  errorCount: number;
}

export interface PageForCompliance {
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  canonical?: string | null;
  mdxBody: string;
  slug: string;
  authorName?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date;
  hasSchemaLD?: boolean;
  isAIGenerated?: boolean;
  wordCount?: number;
}

function check(
  code: string,
  severity: Severity,
  title: string,
  detail: string,
  guidelineSource: "google" | "bing" | "eeat" | "aia",
  pass: boolean
): GuidelineResult {
  return { code, severity, title, detail, guidelineSource, pass };
}

export function checkCompliance(page: PageForCompliance): ComplianceReport {
  const results: GuidelineResult[] = [];
  const body = page.mdxBody ?? "";
  const wordCount = page.wordCount ?? body.split(/\s+/).length;

  // ── Google: Unique, helpful content ────────────────────────────────────────
  results.push(check(
    "G001", "error", "Thin content",
    `Content has ${wordCount} words. Google recommends ≥300 words for indexable pages.`,
    "google",
    wordCount >= 300
  ));

  // ── Google: Title tag ───────────────────────────────────────────────────────
  const metaTitle = page.metaTitle ?? page.title ?? "";
  results.push(check(
    "G002", "warning", "Meta title length",
    `Meta title is ${metaTitle.length} chars. Recommended: 30–60 chars.`,
    "google",
    metaTitle.length >= 30 && metaTitle.length <= 60
  ));

  // ── Google: Meta description ─────────────────────────────────────────────────
  const metaDesc = page.metaDescription ?? "";
  results.push(check(
    "G003", "warning", "Meta description length",
    `Meta description is ${metaDesc.length} chars. Recommended: 120–160 chars.`,
    "google",
    metaDesc.length >= 120 && metaDesc.length <= 160
  ));

  // ── Google: Canonical ────────────────────────────────────────────────────────
  results.push(check(
    "G004", "warning", "Canonical URL",
    page.canonical ? "Canonical URL is set." : "No canonical URL set. Google may choose one arbitrarily.",
    "google",
    !!page.canonical
  ));

  // ── Google: Structured data ──────────────────────────────────────────────────
  results.push(check(
    "G005", "warning", "Structured data (JSON-LD)",
    page.hasSchemaLD ? "JSON-LD structured data present." : "No JSON-LD detected. Add Article, FAQ, or relevant schema.",
    "google",
    !!page.hasSchemaLD
  ));

  // ── Google: Heading structure ────────────────────────────────────────────────
  const h1Count = (body.match(/^#\s+/gm) ?? []).length;
  results.push(check(
    "G006", "error", "Single H1",
    h1Count === 1 ? "Page has exactly one H1." : `Page has ${h1Count} H1s. Must have exactly one.`,
    "google",
    h1Count === 1
  ));

  // ── Google: No keyword stuffing (rough heuristic) ───────────────────────────
  const words = body.toLowerCase().split(/\s+/);
  const freq: Record<string, number> = {};
  for (const w of words) if (w.length > 4) freq[w] = (freq[w] ?? 0) + 1;
  const maxFreq = Math.max(...Object.values(freq), 0);
  const stuffingRatio = wordCount > 0 ? maxFreq / wordCount : 0;
  results.push(check(
    "G007", "warning", "Keyword stuffing",
    stuffingRatio > 0.05
      ? `Most repeated long word appears ${maxFreq} times (${(stuffingRatio * 100).toFixed(1)}% density). May trigger spam signals.`
      : "Keyword density looks natural.",
    "google",
    stuffingRatio <= 0.05
  ));

  // ── Bing: Date freshness ─────────────────────────────────────────────────────
  const updatedAt = page.updatedAt ?? new Date();
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  results.push(check(
    "B001", "info", "Content freshness",
    daysSinceUpdate <= 365
      ? `Content updated ${Math.round(daysSinceUpdate)} day(s) ago.`
      : `Content last updated ${Math.round(daysSinceUpdate / 30)} months ago. Bing rewards fresh content.`,
    "bing",
    daysSinceUpdate <= 365
  ));

  // ── Bing: Alt text (images) ──────────────────────────────────────────────────
  const imgWithoutAlt = (body.match(/!\[\]\(/g) ?? []).length;
  results.push(check(
    "B002", "warning", "Image alt text",
    imgWithoutAlt === 0 ? "All images appear to have alt text." : `${imgWithoutAlt} image(s) have empty alt text.`,
    "bing",
    imgWithoutAlt === 0
  ));

  // ── E-E-A-T: Author attribution ───────────────────────────────────────────────
  results.push(check(
    "E001", "warning", "Author attribution (E-E-A-T)",
    page.authorName ? `Author '${page.authorName}' attributed.` : "No author attributed. E-E-A-T requires clear authorship for YMYL content.",
    "eeat",
    !!page.authorName
  ));

  // ── E-E-A-T: Publication date ────────────────────────────────────────────────
  results.push(check(
    "E002", "info", "Publication date",
    page.publishedAt ? `Published ${page.publishedAt.toISOString().split("T")[0]}.` : "No publication date. Set publishedAt for E-E-A-T signals.",
    "eeat",
    !!page.publishedAt
  ));

  // ── AIA: AI-generated content disclosure ────────────────────────────────────
  if (page.isAIGenerated) {
    const hasDisclosure = /ai-generated|ai generated|generated (by|with) (ai|llm|claude|gpt|gemini)/i.test(body);
    results.push(check(
      "A001", "warning", "AI content disclosure",
      hasDisclosure
        ? "AI-generated content disclosure found."
        : "Content is flagged as AI-generated but has no disclosure. Google recommends transparency.",
      "aia",
      hasDisclosure
    ));
  }

  // ── Slug quality ─────────────────────────────────────────────────────────────
  const slugHasStop = /^(a|an|the|and|or|in|of|to|for|with|on|at)-/.test(page.slug);
  results.push(check(
    "G008", "info", "URL slug quality",
    !slugHasStop ? "Slug looks clean." : "Slug starts with a stop word. Consider removing it for cleaner URLs.",
    "google",
    !slugHasStop
  ));

  const passCount = results.filter((r) => r.pass).length;
  const warnCount = results.filter((r) => !r.pass && r.severity === "warning").length;
  const errorCount = results.filter((r) => !r.pass && r.severity === "error").length;
  const score = Math.round((passCount / results.length) * 100);

  return { score, results, passCount, warnCount, errorCount };
}
