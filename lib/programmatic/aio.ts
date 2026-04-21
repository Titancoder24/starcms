/**
 * AI Overview (AIO) content optimiser.
 *
 * Google's AI Overviews and similar LLM-powered search features tend to surface
 * content that:
 *   1. Opens with a direct, concise answer to the query (2–3 sentences)
 *   2. Uses clear entity definitions
 *   3. Contains structured step-by-step or list content
 *   4. Has explicit FAQ sections with question-format H3s
 *   5. Includes Speakable schema hints (human-readable sentences)
 *
 * This module wraps or rewrites raw MDX to comply with those signals.
 */

export interface AIOOptions {
  /** The primary search query this page targets. */
  query: string;
  /** A concise, authoritative 1-3 sentence direct answer. */
  directAnswer: string;
  /** Key entities/terms that should be explicitly defined early. */
  keyEntities?: Array<{ term: string; definition: string }>;
}

export interface AIOResult {
  mdxBody: string;
  /** Speakable text blocks suitable for speakable schema. */
  speakableBlocks: string[];
}

/**
 * Prepend AIO-optimised scaffolding to existing MDX content.
 * Non-destructive — original content follows after the preamble.
 */
export function wrapWithAIO(originalMdx: string, opts: AIOOptions): AIOResult {
  const { query, directAnswer, keyEntities = [] } = opts;

  const definitionsSection =
    keyEntities.length > 0
      ? `## Key Terms\n\n${keyEntities.map((e) => `**${e.term}:** ${e.definition}`).join("\n\n")}\n\n`
      : "";

  const preamble = `> **${query}** — ${directAnswer}

${definitionsSection}`;

  const mdxBody = `${preamble}\n${originalMdx}`;
  const speakableBlocks = [directAnswer, ...keyEntities.map((e) => `${e.term}: ${e.definition}`)];

  return { mdxBody, speakableBlocks };
}

/**
 * Rewrite headings to be question-format (improves featured snippet capture).
 * "Introduction" → "What Is X?" etc. Only rewrites generic headings.
 */
export function questionifyHeadings(mdx: string, topic: string): string {
  const genericHeadings: Record<string, string> = {
    "introduction": `What Is ${topic}?`,
    "overview": `What Is ${topic}? An Overview`,
    "how it works": `How Does ${topic} Work?`,
    "benefits": `What Are the Benefits of ${topic}?`,
    "features": `What Features Does ${topic} Offer?`,
    "pricing": `How Much Does ${topic} Cost?`,
    "conclusion": `Is ${topic} Worth It?`,
    "summary": `${topic}: Key Takeaways`,
  };

  return mdx.replace(/^(#{1,3})\s+(.+)$/gm, (match, hashes: string, heading: string) => {
    const lower = heading.toLowerCase().trim();
    const replacement = genericHeadings[lower];
    return replacement ? `${hashes} ${replacement}` : match;
  });
}

/**
 * Score a piece of MDX content for AIO-readiness (0–100).
 */
export interface AIOScore {
  total: number;
  breakdown: Record<string, { score: number; max: number; note: string }>;
}

export function scoreAIO(mdx: string): AIOScore {
  const breakdown: Record<string, { score: number; max: number; note: string }> = {};

  // Direct answer block (blockquote near top)
  const hasDirectAnswer = /^>.*\n/.test(mdx.slice(0, 500));
  breakdown["directAnswer"] = {
    score: hasDirectAnswer ? 20 : 0,
    max: 20,
    note: hasDirectAnswer ? "Has direct-answer blockquote" : "Missing direct-answer blockquote at top",
  };

  // FAQ section
  const hasFAQ = /<FAQ>/.test(mdx);
  breakdown["faqSection"] = {
    score: hasFAQ ? 20 : 0,
    max: 20,
    note: hasFAQ ? "Has FAQ section" : "Missing <FAQ> component",
  };

  // Question-format H2s
  const h2s = [...mdx.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1] ?? "");
  const questionH2s = h2s.filter((h) => /\?$/.test(h)).length;
  const questionScore = Math.min(20, questionH2s * 7);
  breakdown["questionHeadings"] = {
    score: questionScore,
    max: 20,
    note: `${questionH2s} question-format H2(s)`,
  };

  // Structured lists or tables
  const listCount = (mdx.match(/^[-*]\s/gm) ?? []).length;
  const tableCount = (mdx.match(/^\|/gm) ?? []).length;
  const structureScore = Math.min(20, (listCount + tableCount) * 2);
  breakdown["structuredContent"] = {
    score: structureScore,
    max: 20,
    note: `${listCount} list items, ${tableCount} table rows`,
  };

  // Word count ≥ 600
  const wordCount = mdx.split(/\s+/).length;
  breakdown["wordCount"] = {
    score: wordCount >= 600 ? 20 : Math.round((wordCount / 600) * 20),
    max: 20,
    note: `${wordCount} words (min 600)`,
  };

  const total = Object.values(breakdown).reduce((sum, v) => sum + v.score, 0);
  return { total, breakdown };
}

/**
 * Generate a fully AIO-optimised page from scratch.
 */
export interface AIOPageOptions {
  query: string;
  directAnswer: string;
  keyEntities?: Array<{ term: string; definition: string }>;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  faqs?: Array<{ question: string; answer: string }>;
  metaTitle?: string;
  metaDescription?: string;
}

export interface AIOPageOutput {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  mdxBody: string;
  speakableBlocks: string[];
  aioScore: AIOScore;
}

export function generateAIOPage(opts: AIOPageOptions): AIOPageOutput {
  const { query, directAnswer, keyEntities = [], sections, faqs = [] } = opts;
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const title = query;
  const metaTitle = opts.metaTitle ?? `${query} — Expert Guide (${new Date().getFullYear()})`;
  const metaDescription = opts.metaDescription ?? directAnswer;

  const definitionsBlock =
    keyEntities.length > 0
      ? `## Key Definitions\n\n${keyEntities.map((e) => `**${e.term}:** ${e.definition}`).join("\n\n")}\n\n`
      : "";

  const sectionsBlock = sections
    .map((s) => `## ${s.heading.endsWith("?") ? s.heading : s.heading}\n\n${s.content}`)
    .join("\n\n");

  const faqBlock =
    faqs.length > 0
      ? `## Frequently Asked Questions\n\n<FAQ>\n${faqs
          .map(
            (f) =>
              `<FAQItem question="${f.question}">\n${f.answer}\n</FAQItem>`
          )
          .join("\n")}\n</FAQ>`
      : "";

  const mdxBody = `# ${query}

> ${directAnswer}

${definitionsBlock}${sectionsBlock}

${faqBlock}
`;

  const speakableBlocks = [directAnswer, ...keyEntities.map((e) => `${e.term}: ${e.definition}`)];
  const aioScore = scoreAIO(mdxBody);

  return { slug, title, metaTitle, metaDescription, mdxBody, speakableBlocks, aioScore };
}
