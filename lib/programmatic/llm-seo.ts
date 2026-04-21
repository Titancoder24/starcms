/**
 * LLM-SEO optimiser.
 *
 * Optimises content for LLM-powered search surfaces:
 *   - ChatGPT Search / Browse
 *   - Perplexity AI
 *   - Google AI Overviews
 *   - Bing Copilot
 *   - Claude.ai / Anthropic
 *
 * Key signals: entity clarity, fact density, source attribution,
 * semantic headings, structured data hints, llms.txt compliance.
 */

export interface LLMSEOOptions {
  /** Primary entity this content is about. */
  primaryEntity: string;
  /** Related entities to cross-reference. */
  relatedEntities?: string[];
  /** Citations / sources to attribute. */
  citations?: Array<{ title: string; url: string; year?: number }>;
  /** Author expertise statement (E-E-A-T). */
  authorExpertise?: string;
}

export interface LLMSEOScore {
  total: number;
  breakdown: Record<string, { score: number; max: number; note: string }>;
}

/**
 * Score content for LLM-search readiness (0–100).
 */
export function scoreLLMSEO(mdx: string, opts?: LLMSEOOptions): LLMSEOScore {
  const breakdown: Record<string, { score: number; max: number; note: string }> = {};

  // Entity clarity: primary entity mentioned in first 100 chars
  const hasEntityInOpening = opts?.primaryEntity
    ? mdx.slice(0, 200).toLowerCase().includes(opts.primaryEntity.toLowerCase())
    : false;
  breakdown["entityClarity"] = {
    score: hasEntityInOpening ? 15 : 5,
    max: 15,
    note: hasEntityInOpening ? "Primary entity appears in opening" : "Primary entity not prominent",
  };

  // Fact density: sentences with numbers, dates, or specifics
  const sentences = mdx.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const factSentences = sentences.filter((s) =>
    /\d+(%|px|ms|kb|mb|gb|k|m|b|\s+(years?|months?|days?|hours?)|\$|€|£)/.test(s)
  ).length;
  const factRatio = sentences.length > 0 ? factSentences / sentences.length : 0;
  breakdown["factDensity"] = {
    score: Math.min(20, Math.round(factRatio * 80)),
    max: 20,
    note: `${factSentences}/${sentences.length} fact-bearing sentences`,
  };

  // Structured headings (H2s that read as questions or clear topics)
  const h2s = [...mdx.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1] ?? "");
  const goodHeadings = h2s.filter((h) => h.length > 5 && h.length < 80).length;
  breakdown["structuredHeadings"] = {
    score: Math.min(15, goodHeadings * 5),
    max: 15,
    note: `${goodHeadings} well-formed H2s`,
  };

  // Source attribution
  const hasCitations = /\[.+\]\(https?:\/\/.+\)/.test(mdx);
  breakdown["sourceAttribution"] = {
    score: hasCitations ? 15 : 0,
    max: 15,
    note: hasCitations ? "Has inline citations" : "No source citations",
  };

  // Semantic HTML structure (not just walls of text — has lists/tables)
  const hasLists = /^[-*]\s/m.test(mdx);
  const hasTables = /^\|/m.test(mdx);
  breakdown["semanticStructure"] = {
    score: (hasLists ? 10 : 0) + (hasTables ? 5 : 0),
    max: 15,
    note: `Lists: ${hasLists ? "yes" : "no"}, Tables: ${hasTables ? "yes" : "no"}`,
  };

  // E-E-A-T signals (author, date, expertise)
  const hasAuthorMention = /\*?(reviewed|written|by|author)\b/i.test(mdx);
  breakdown["eeat"] = {
    score: hasAuthorMention ? 10 : 0,
    max: 10,
    note: hasAuthorMention ? "Has author/review attribution" : "Missing E-E-A-T signals",
  };

  // Word count ≥ 800 for LLM training signal
  const wordCount = mdx.split(/\s+/).length;
  breakdown["contentDepth"] = {
    score: wordCount >= 800 ? 10 : Math.round((wordCount / 800) * 10),
    max: 10,
    note: `${wordCount} words (min 800)`,
  };

  const total = Object.values(breakdown).reduce((sum, v) => sum + v.score, 0);
  return { total, breakdown };
}

/**
 * Append LLM-SEO enhancements to existing MDX.
 * Adds entity graph footer, citations section, and author attribution.
 */
export function enhanceForLLMSearch(
  mdx: string,
  opts: LLMSEOOptions
): string {
  const { primaryEntity, relatedEntities = [], citations = [], authorExpertise } = opts;

  const relatedSection =
    relatedEntities.length > 0
      ? `\n\n## Related Topics\n\n${relatedEntities.map((e) => `- ${e}`).join("\n")}`
      : "";

  const citationsSection =
    citations.length > 0
      ? `\n\n## Sources & References\n\n${citations
          .map((c, i) => `${i + 1}. [${c.title}](${c.url})${c.year ? ` (${c.year})` : ""}`)
          .join("\n")}`
      : "";

  const authorSection = authorExpertise
    ? `\n\n---\n\n*This content about **${primaryEntity}** was ${authorExpertise}.*`
    : "";

  return `${mdx}${relatedSection}${citationsSection}${authorSection}`;
}

/**
 * Generate an llms.txt-compliant content index entry for a piece of content.
 */
export function buildLLMsEntry(opts: {
  title: string;
  url: string;
  excerpt?: string;
  primaryEntity?: string;
  relatedEntities?: string[];
}): string {
  const { title, url, excerpt, primaryEntity, relatedEntities = [] } = opts;
  const entityTag = primaryEntity ? ` [${primaryEntity}]` : "";
  const relatedTags = relatedEntities.map((e) => `[${e}]`).join(" ");
  return `- [${title}](${url})${entityTag}${relatedTags ? ` ${relatedTags}` : ""}${excerpt ? `: ${excerpt}` : ""}`;
}
