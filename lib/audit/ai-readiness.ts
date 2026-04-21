import { wordCount } from "@/lib/util/readability";
import { fleschReadingEase } from "@/lib/util/readability";

export type AiReadinessResult = {
  score: number;
  details: Array<{ check: string; pass: boolean; note: string }>;
};

export async function checkAiReadiness(
  url: string,
  html: string,
  siteBaseUrl: string
): Promise<AiReadinessResult> {
  const details: Array<{ check: string; pass: boolean; note: string }> = [];

  // 1. llms.txt reachable
  let llmsTxtOk = false;
  try {
    const llmsUrl = new URL("/llms.txt", siteBaseUrl).toString();
    const res = await fetch(llmsUrl, { method: "HEAD" });
    llmsTxtOk = res.ok;
  } catch { llmsTxtOk = false; }
  details.push({ check: "llms.txt", pass: llmsTxtOk, note: llmsTxtOk ? "llms.txt is reachable" : "llms.txt not found at site root" });

  // 2. JSON-LD schema present
  const hasSchema = html.includes('"application/ld+json"') || html.includes("application/ld+json");
  details.push({ check: "json-ld", pass: hasSchema, note: hasSchema ? "JSON-LD schema found" : "No JSON-LD schema detected" });

  // 3. Semantic HTML tags
  const semanticTags = ["<article", "<section", "<main", "<nav", "<aside", "<header", "<footer", "<h1", "<h2", "<h3"];
  const semanticCount = semanticTags.filter((tag) => html.toLowerCase().includes(tag)).length;
  const semanticOk = semanticCount >= 4;
  details.push({ check: "semantic-html", pass: semanticOk, note: `${semanticCount}/10 semantic HTML elements detected` });

  // 4. FAQ/HowTo content
  const hasFaq = html.includes('"FAQPage"') || html.includes('"FAQ"') || /<h[23][^>]*>[^<]*\?/i.test(html);
  details.push({ check: "faq-howto", pass: hasFaq, note: hasFaq ? "FAQ or Q&A content found" : "No FAQ/HowTo blocks detected" });

  // 5. Word count / substance
  const text = html.replace(/<[^>]+>/g, " ");
  const wc = wordCount(text);
  const wordCountOk = wc >= 300;
  details.push({ check: "word-count", pass: wordCountOk, note: `${wc} words (minimum 300 for AI readiness)` });

  // 6. Reading level
  const reading = Math.round(fleschReadingEase(text));
  const readingOk = reading >= 40;
  details.push({ check: "reading-level", pass: readingOk, note: `Flesch score: ${reading} (minimum 40)` });

  // 7. E-E-A-T author info
  const hasAuthor =
    html.includes('"author"') ||
    html.includes('itemprop="author"') ||
    /by\s+[A-Z][a-z]+/i.test(html);
  details.push({ check: "eeat-author", pass: hasAuthor, note: hasAuthor ? "Author information found" : "No author attribution detected" });

  // 8. Open Graph / meta
  const hasOg = html.includes('property="og:title"') || html.includes('og:description');
  details.push({ check: "open-graph", pass: hasOg, note: hasOg ? "Open Graph meta tags present" : "Missing Open Graph meta tags" });

  const passCount = details.filter((d) => d.pass).length;
  const score = Math.round((passCount / details.length) * 100);

  return { score, details };
}
