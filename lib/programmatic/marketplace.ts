/**
 * Marketplace / lead-gen page engine.
 * Generates listing pages with ItemList + Offer JSON-LD.
 * Each page is a curated list of entities with CTAs driving to destinations.
 * Designed for affiliate, directory, and comparison-marketplace use cases.
 */

import type { Entity, Cta } from "@/lib/db/schema";

export interface MarketplacePageOutput {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  mdxBody: string;
}

export interface MarketplaceListing {
  entity: Entity;
  ctas: Cta[];
  featured?: boolean;
  badge?: string;
}

function buildListingCard(listing: MarketplaceListing, position: number): string {
  const { entity, ctas, featured, badge } = listing;
  const ratingLine =
    entity.ratingValue != null
      ? `**Rating:** ${"★".repeat(Math.round(entity.ratingValue))}${"☆".repeat(5 - Math.round(entity.ratingValue))} ${entity.ratingValue.toFixed(1)}/5`
      : "";
  const priceLine = entity.priceRange ? `**Price:** ${entity.priceRange}` : "";
  const ctaLine = ctas
    .map((c) => `[${c.label}](${c.url})`)
    .join(" | ");
  const badgeLine = badge ? `> 🏷️ **${badge}**\n\n` : featured ? `> ⭐ **Featured**\n\n` : "";
  const pros = (entity.pros ?? []).slice(0, 3).map((p) => `- ${p}`).join("\n");
  const affiliateNote = ctas.some((c) => c.isAffiliate)
    ? "\n\n_Disclosure: This listing contains affiliate links. We may earn a commission at no extra cost to you._"
    : "";
  const disclosure = ctas.find((c) => c.isAffiliate && c.affiliateDisclosure)?.affiliateDisclosure;

  return `### ${position}. ${entity.name}

${badgeLine}${entity.description ?? ""}

${ratingLine}
${priceLine}

${pros ? `**Highlights:**\n${pros}` : ""}

${ctaLine || (entity.url ? `[Visit ${entity.name}](${entity.url})` : "")}
${disclosure ? `\n_${disclosure}_` : affiliateNote}
`;
}

export function generateMarketplacePage(
  topic: string,
  listings: MarketplaceListing[],
  options?: {
    slug?: string;
    metaTitle?: string;
    metaDescription?: string;
    intro?: string;
    buyingGuide?: string;
    templateMdx?: string;
  }
): MarketplacePageOutput {
  const year = new Date().getFullYear();
  const slug = options?.slug ?? `best-${topic.toLowerCase().replace(/\s+/g, "-")}-${year}`;
  const title = `Best ${topic} in ${year}`;
  const metaTitle =
    options?.metaTitle ?? `Best ${topic} in ${year}: Top ${listings.length} Options Reviewed & Ranked`;
  const metaDescription =
    options?.metaDescription ??
    `Discover the best ${topic} in ${year}. We've reviewed and ranked the top ${listings.length} options by features, pricing, and user ratings to help you choose with confidence.`;

  const sortedListings = [...listings].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (b.entity.ratingValue ?? 0) - (a.entity.ratingValue ?? 0);
  });

  const listingCards = sortedListings
    .map((l, i) => buildListingCard(l, i + 1))
    .join("\n---\n\n");

  const hasAffiliate = listings.some((l) => l.ctas.some((c) => c.isAffiliate));

  const mdxBody =
    options?.templateMdx ??
    `# ${title}

${hasAffiliate ? `> **Disclosure:** Some links on this page are affiliate links. We may earn a commission at no extra cost to you. Our rankings are based on independent research and user feedback.\n\n` : ""}${options?.intro ?? `Finding the right ${topic} can be overwhelming. We've done the research so you don't have to — here are the top ${listings.length} options available in ${year}.`}

## Quick Picks

${sortedListings.slice(0, 3).map((l, i) => `${i + 1}. **${l.entity.name}** – ${l.entity.description ?? "A top-rated option"}${l.entity.ratingValue ? ` (${l.entity.ratingValue.toFixed(1)}/5)` : ""}`).join("\n")}

## Full Rankings: Best ${topic} in ${year}

${listingCards}

${options?.buyingGuide ?? `## How to Choose the Right ${topic}

When evaluating your options, consider:

1. **Budget** – Determine your price range before comparing options.
2. **Features** – List the must-have features for your specific use case.
3. **Reviews** – Check verified user reviews, not just marketing claims.
4. **Support** – Ensure the provider offers adequate customer support.
5. **Scalability** – Choose an option that can grow with your needs.`}

## Frequently Asked Questions

<FAQ>
<FAQItem question="What is the best ${topic} in ${year}?">
${sortedListings[0] ? `Based on our analysis, **${sortedListings[0].entity.name}** is the top-rated ${topic} in ${year}, particularly for ${(sortedListings[0].entity.pros ?? [])[0] ?? "its comprehensive feature set"}.` : `The best option depends on your specific needs and budget. See our full rankings above.`}
</FAQItem>
<FAQItem question="How did you rank these ${topic} options?">
We ranked based on user ratings, feature completeness, pricing transparency, and customer support quality. All rankings reflect independent research.
</FAQItem>
<FAQItem question="Are these ${topic} recommendations up to date?">
Yes — this guide was last updated for ${year} and reflects current pricing, features, and user feedback.
</FAQItem>
</FAQ>
`;

  return { slug, title, metaTitle, metaDescription, mdxBody };
}
