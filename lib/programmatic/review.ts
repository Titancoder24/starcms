/**
 * Review page engine.
 * Generates structured review pages with Review + AggregateRating JSON-LD.
 * Follows E-E-A-T guidelines: explicit verdict, star rating, pros/cons, who it's for.
 */

import type { Entity } from "@/lib/db/schema";

export interface ReviewPageOutput {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  mdxBody: string;
}

function starDisplay(rating: number): string {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function buildRatingBreakdown(entity: Entity): string {
  if (entity.ratingValue == null) return "";
  const stars = starDisplay(entity.ratingValue);
  return `**Overall Rating:** ${stars} ${entity.ratingValue.toFixed(1)}/5${entity.ratingCount ? ` (${entity.ratingCount} reviews)` : ""}`;
}

function buildAttributeTable(entity: Entity): string {
  const attrs = Object.entries(entity.attributes ?? {});
  if (attrs.length === 0) return "";
  const rows = attrs.map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  return `| Attribute | Value |\n| --- | --- |\n${rows}`;
}

export function generateReviewPage(
  entity: Entity,
  options?: {
    reviewerName?: string;
    reviewDate?: string;
    templateMdx?: string;
    metaTitle?: string;
    metaDescription?: string;
    verdict?: string;
    whoItsFor?: string;
    whoItsNotFor?: string;
  }
): ReviewPageOutput {
  const slug = `${entity.slug}-review`;
  const year = new Date().getFullYear();
  const title = `${entity.name} Review (${year})`;
  const metaTitle =
    options?.metaTitle ?? `${entity.name} Review ${year}: Honest Pros, Cons & Verdict`;
  const metaDescription =
    options?.metaDescription ??
    `An in-depth ${entity.name} review covering features, pricing, pros and cons. Is it worth it in ${year}? Read our expert verdict.`;

  const ratingDisplay = buildRatingBreakdown(entity);
  const attrTable = buildAttributeTable(entity);
  const pros = (entity.pros ?? []).map((p) => `- ✓ ${p}`).join("\n");
  const cons = (entity.cons ?? []).map((c) => `- ✗ ${c}`).join("\n");
  const verdict = options?.verdict ?? `${entity.name} is a ${entity.ratingValue && entity.ratingValue >= 4 ? "strong" : "decent"} choice for ${options?.whoItsFor ?? "most users"}.`;

  const mdxBody =
    options?.templateMdx ??
    `# ${title}

> **Verdict:** ${verdict}

${ratingDisplay}

## What is ${entity.name}?

${entity.description ?? `${entity.name} is a ${entity.type} offering a range of features designed to address common user needs.`}${entity.url ? ` [Visit ${entity.name}](${entity.url})` : ""}

## Key Specifications

${attrTable || "_No specification data available._"}

${entity.priceRange ? `**Pricing:** ${entity.priceRange}` : ""}

## Pros and Cons

**What we liked**

${pros || "- No specific pros recorded"}

**What could be better**

${cons || "- No specific cons recorded"}

## Who Is ${entity.name} For?

${options?.whoItsFor ? `**Best for:** ${options.whoItsFor}` : `This ${entity.type} suits users looking for a reliable, well-rounded solution.`}

${options?.whoItsNotFor ? `**Not ideal for:** ${options.whoItsNotFor}` : ""}

## Our Final Verdict

${verdict}

${options?.reviewerName ? `*Reviewed by ${options.reviewerName}${options.reviewDate ? ` on ${options.reviewDate}` : ""}*` : ""}

## Frequently Asked Questions

<FAQ>
<FAQItem question="Is ${entity.name} worth it?">
${entity.ratingValue && entity.ratingValue >= 4 ? `Yes — with a ${entity.ratingValue.toFixed(1)}/5 rating, ${entity.name} delivers strong value. ${verdict}` : `It depends on your needs. ${verdict}`}
</FAQItem>
<FAQItem question="What are the main pros of ${entity.name}?">
${(entity.pros ?? []).slice(0, 3).join("; ") || "See the pros and cons section above for details."}
</FAQItem>
<FAQItem question="What are the main cons of ${entity.name}?">
${(entity.cons ?? []).slice(0, 3).join("; ") || "See the pros and cons section above for details."}
</FAQItem>
<FAQItem question="How much does ${entity.name} cost?">
${entity.priceRange ? `${entity.name} is priced at ${entity.priceRange}. Check the official website for the latest pricing.` : "Pricing information is not available. Visit the official website for current plans."}
</FAQItem>
</FAQ>
`;

  return { slug, title, metaTitle, metaDescription, mdxBody };
}
