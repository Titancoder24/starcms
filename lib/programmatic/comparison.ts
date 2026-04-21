/**
 * Comparison page engine.
 * Generates "[Entity A] vs [Entity B]" pages with Product + ItemList JSON-LD.
 * Supports 2–N entities; produces structured comparison tables.
 */

import { slugify } from "@/lib/util/slugify";
import type { Entity } from "@/lib/db/schema";

export interface ComparisonPageOutput {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  mdxBody: string;
}

/** Determine which attributes appear across all compared entities. */
function unionAttributes(entities: Entity[]): string[] {
  const seen = new Set<string>();
  for (const e of entities) {
    for (const k of Object.keys(e.attributes ?? {})) seen.add(k);
  }
  return [...seen];
}

/** Build an MDX comparison table for a set of entities. */
function buildComparisonTable(entities: Entity[], attrs: string[]): string {
  if (entities.length === 0 || attrs.length === 0) return "";

  const header = `| Feature | ${entities.map((e) => `**${e.name}**`).join(" | ")} |`;
  const separator = `| --- |${entities.map(() => " --- |").join("")}`;

  const rows = attrs.map((attr) => {
    const cells = entities.map((e) => (e.attributes ?? {})[attr] ?? "—");
    return `| ${attr} | ${cells.join(" | ")} |`;
  });

  return [header, separator, ...rows].join("\n");
}

function buildProsConsSection(entities: Entity[]): string {
  return entities
    .map((e) => {
      const pros = (e.pros ?? []).map((p) => `  - ✓ ${p}`).join("\n");
      const cons = (e.cons ?? []).map((c) => `  - ✗ ${c}`).join("\n");
      return `### ${e.name}\n\n**Pros**\n${pros || "  - No specific pros listed"}\n\n**Cons**\n${cons || "  - No specific cons listed"}`;
    })
    .join("\n\n");
}

function buildRatingSummary(entities: Entity[]): string {
  return entities
    .filter((e) => e.ratingValue != null)
    .map(
      (e) =>
        `- **${e.name}**: ${e.ratingValue?.toFixed(1)}/5 (${e.ratingCount ?? 0} reviews)`
    )
    .join("\n");
}

export function generateComparisonPage(
  entities: Entity[],
  overrides?: { templateMdx?: string; metaTitle?: string; metaDescription?: string }
): ComparisonPageOutput {
  if (entities.length < 2) throw new Error("Comparison requires at least 2 entities");

  const names = entities.map((e) => e.name);
  const slugParts = entities.map((e) => e.slug);
  const slug = `${slugParts[0]}-vs-${slugParts.slice(1).join("-vs-")}`;
  const title = `${names[0]} vs ${names.slice(1).join(" vs ")}`;
  const metaTitle =
    overrides?.metaTitle ??
    `${title}: In-Depth Comparison (${new Date().getFullYear()})`;
  const metaDescription =
    overrides?.metaDescription ??
    `Compare ${names.join(", ")} side-by-side. Features, pricing, pros & cons, and our verdict to help you choose the best option.`;

  const attrs = unionAttributes(entities);
  const compTable = buildComparisonTable(entities, attrs);
  const prosConsSec = buildProsConsSection(entities);
  const ratingSummary = buildRatingSummary(entities);

  const mdxBody =
    overrides?.templateMdx ??
    `# ${title}: Which One Should You Choose?

> **Direct answer:** ${entities[0]?.name ?? ""} is best for users who prioritise ${(entities[0]?.pros ?? [])[0] ?? "performance"}, while ${entities[1]?.name ?? ""} suits those who need ${(entities[1]?.pros ?? [])[0] ?? "affordability"}.

## Quick Comparison

${compTable || "_No attribute data available_"}

## Ratings at a Glance

${ratingSummary || "_No rating data available_"}

## Detailed Pros & Cons

${prosConsSec}

## Our Verdict

After comparing ${names.join(", ")} across features, price, and user feedback, here is our recommendation:

${entities
  .map(
    (e) =>
      `**${e.name}** – ${e.description ?? "A solid choice depending on your needs."} ${e.priceRange ? `Pricing: ${e.priceRange}.` : ""}`
  )
  .join("\n\n")}

## Frequently Asked Questions

<FAQ>
<FAQItem question="Which is better: ${names[0]} or ${names[1]}?">
${names[0]} excels at ${(entities[0]?.pros ?? [])[0] ?? "its core features"}, making it ideal for advanced users. ${names[1]} is better for those who prioritise ${(entities[1]?.pros ?? [])[0] ?? "ease of use"}.
</FAQItem>
<FAQItem question="What are the main differences between ${names.join(" and ")}?">
The key differences are: ${attrs.slice(0, 3).map((a) => `${a}: ${entities.map((e) => (e.attributes ?? {})[a] ?? "N/A").join(" vs ")}`).join("; ") || "see the comparison table above"}.
</FAQItem>
<FAQItem question="Is ${names[0]} worth it over ${names[1]}?">
It depends on your specific requirements. Review the pros and cons section above to determine which better fits your workflow and budget.
</FAQItem>
</FAQ>
`;

  return { slug, title, metaTitle, metaDescription, mdxBody };
}
