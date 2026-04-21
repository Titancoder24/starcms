import type { Post, Page, Site, Author, Entity, Location } from "@/lib/db/schema";

type JsonLd = Record<string, unknown>;

export function generateOrganization(site: Site): JsonLd {
  const org = site.settings?.organization;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org?.legalName ?? site.name,
    url: site.domain ? `https://${site.domain}` : undefined,
    logo: org?.logoUrl
      ? {
          "@type": "ImageObject",
          url: org.logoUrl,
        }
      : undefined,
    sameAs: org?.sameAs ?? [],
  };
}

export function generateWebSite(site: Site): JsonLd {
  const baseUrl = site.domain ? `https://${site.domain}` : "";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: baseUrl || undefined,
    potentialAction: baseUrl
      ? {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        }
      : undefined,
  };
}

function generatePerson(author: Author): JsonLd {
  return {
    "@type": "Person",
    name: author.name,
    url: author.socialLinks?.website ?? undefined,
    image: author.image ?? undefined,
    description: author.bio ?? undefined,
    knowsAbout: author.expertise ?? undefined,
    sameAs: Object.values(author.socialLinks ?? {}).filter(Boolean),
    hasCredential: author.credentials ?? undefined,
  };
}

function generateBreadcrumb(
  post: Post | Page,
  site: Site,
  contentType: "post" | "page"
): JsonLd {
  const baseUrl = site.domain ? `https://${site.domain}` : "";
  const path = contentType === "post" ? `/p/${post.slug}` : `/${post.slug}`;
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: site.name,
        item: baseUrl || undefined,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.title,
        item: baseUrl ? `${baseUrl}${path}` : undefined,
      },
    ],
  };
}

function extractFaq(
  mdx: string
): Array<{ question: string; answer: string }> | null {
  const faqMatch = mdx.match(/<FAQ>([\s\S]*?)<\/FAQ>/i);
  if (!faqMatch?.[1]) return null;
  const items: Array<{ question: string; answer: string }> = [];
  const itemRegex =
    /<FAQItem[^>]*question=["']([^"']+)["'][^>]*>([\s\S]*?)<\/FAQItem>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(faqMatch[1])) !== null) {
    if (m[1] && m[2]) {
      items.push({ question: m[1], answer: m[2].trim() });
    }
  }
  return items.length > 0 ? items : null;
}

function extractHowTo(
  mdx: string
): { name: string; steps: Array<{ text: string }> } | null {
  const howToMatch = mdx.match(/<HowTo[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/HowTo>/i);
  if (!howToMatch?.[1] || !howToMatch?.[2]) return null;
  const steps: Array<{ text: string }> = [];
  const stepRegex = /<Step[^>]*>([\s\S]*?)<\/Step>/gi;
  let m: RegExpExecArray | null;
  while ((m = stepRegex.exec(howToMatch[2])) !== null) {
    if (m[1]) steps.push({ text: m[1].trim() });
  }
  return steps.length > 0 ? { name: howToMatch[1], steps } : null;
}

export function generateSchemaForPost(
  post: Post,
  site: Site,
  author?: Author
): JsonLd {
  const baseUrl = site.domain ? `https://${site.domain}` : "";
  const url = baseUrl ? `${baseUrl}/p/${post.slug}` : undefined;

  const graph: JsonLd[] = [
    {
      "@type": "Article",
      "@id": url ? `${url}#article` : undefined,
      headline: post.title,
      description: post.metaDescription ?? post.excerpt ?? undefined,
      url,
      datePublished: post.publishedAt?.toISOString() ?? undefined,
      dateModified: post.updatedAt?.toISOString() ?? undefined,
      author: author ? generatePerson(author) : undefined,
      publisher: {
        "@type": "Organization",
        name: site.settings?.organization?.legalName ?? site.name,
        logo: site.settings?.organization?.logoUrl
          ? { "@type": "ImageObject", url: site.settings.organization.logoUrl }
          : undefined,
      },
      image: post.seo?.openGraphImage ?? undefined,
      isPartOf: {
        "@type": "WebSite",
        name: site.name,
        url: baseUrl || undefined,
      },
    },
    generateBreadcrumb(post, site, "post"),
  ];

  const faqItems = extractFaq(post.mdxBody);
  if (faqItems) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  const howTo = extractHowTo(post.mdxBody);
  if (howTo) {
    graph.push({
      "@type": "HowTo",
      name: howTo.name,
      step: howTo.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text: s.text,
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

/**
 * LocalBusiness JSON-LD for geo pages.
 * Used on "[keyword] in [city]" programmatic pages.
 */
export function generateLocalBusiness(opts: {
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: {
    streetAddress?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
  };
  geo?: { latitude: number; longitude: number };
  openingHours?: string[];
  priceRange?: string;
  image?: string;
  ratingValue?: number;
  ratingCount?: number;
}): JsonLd {
  const { name, description, url, telephone, address, geo, openingHours, priceRange, image, ratingValue, ratingCount } = opts;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description,
    url,
    telephone,
    image,
    priceRange,
    openingHoursSpecification: openingHours?.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h })),
    address: {
      "@type": "PostalAddress",
      streetAddress: address.streetAddress,
      addressLocality: address.city,
      addressRegion: address.region,
      postalCode: address.postalCode,
      addressCountry: address.country,
    },
    geo: geo
      ? { "@type": "GeoCoordinates", latitude: geo.latitude, longitude: geo.longitude }
      : undefined,
    aggregateRating:
      ratingValue != null
        ? { "@type": "AggregateRating", ratingValue, reviewCount: ratingCount ?? 0 }
        : undefined,
  };
}

/**
 * Product JSON-LD for comparison / review pages.
 */
export function generateProduct(entity: Entity, baseUrl?: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: entity.name,
    description: entity.description ?? undefined,
    url: entity.url ?? (baseUrl ? `${baseUrl}/${entity.slug}-review` : undefined),
    image: entity.logoUrl ?? undefined,
    offers: entity.priceRange
      ? {
          "@type": "Offer",
          price: entity.priceRange,
          priceCurrency: "USD",
        }
      : undefined,
    aggregateRating:
      entity.ratingValue != null
        ? {
            "@type": "AggregateRating",
            ratingValue: entity.ratingValue,
            reviewCount: entity.ratingCount ?? 0,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };
}

/**
 * Review JSON-LD for a single entity review page.
 */
export function generateReview(opts: {
  entity: Entity;
  reviewBody: string;
  reviewerName?: string;
  reviewDate?: string;
  ratingValue: number;
  baseUrl?: string;
}): JsonLd {
  const { entity, reviewBody, reviewerName, reviewDate, ratingValue, baseUrl } = opts;
  return {
    "@context": "https://schema.org",
    "@graph": [
      generateProduct(entity, baseUrl),
      {
        "@type": "Review",
        itemReviewed: {
          "@type": "Product",
          name: entity.name,
        },
        author: reviewerName ? { "@type": "Person", name: reviewerName } : undefined,
        datePublished: reviewDate ?? new Date().toISOString().split("T")[0],
        reviewBody,
        reviewRating: {
          "@type": "Rating",
          ratingValue,
          bestRating: 5,
          worstRating: 1,
        },
      },
    ],
  };
}

/**
 * ItemList JSON-LD for marketplace / ranking pages.
 * Each entity gets a ListItem with its position and URL.
 */
export function generateItemList(opts: {
  name: string;
  description?: string;
  url?: string;
  items: Array<{ entity: Entity; position: number; url?: string }>;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map(({ entity, position, url }) => ({
      "@type": "ListItem",
      position,
      name: entity.name,
      url: url ?? entity.url ?? undefined,
      item: {
        "@type": "Product",
        name: entity.name,
        description: entity.description ?? undefined,
        image: entity.logoUrl ?? undefined,
      },
    })),
  };
}

/**
 * Speakable schema for AIO-optimised content.
 * Marks specific CSS selectors / xpaths as speakable.
 */
export function generateSpeakable(url: string, cssSelectors = [".direct-answer", "h1", "h2"]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: cssSelectors,
    },
    url,
  };
}

/**
 * Full schema graph for a geo page.
 */
export function generateSchemaForGeoPage(opts: {
  title: string;
  description?: string;
  slug: string;
  site: Site;
  location: Location;
  keyword: string;
}): JsonLd {
  const { title, description, slug, site, location, keyword } = opts;
  const baseUrl = site.domain ? `https://${site.domain}` : "";
  const url = baseUrl ? `${baseUrl}/${slug}` : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
        description,
        url,
        isPartOf: { "@type": "WebSite", name: site.name, url: baseUrl || undefined },
      },
      generateLocalBusiness({
        name: `${keyword} in ${location.city}`,
        description: `Find ${keyword} services in ${location.city}${location.region ? `, ${location.region}` : ""}.`,
        url,
        address: {
          city: location.city,
          region: location.region ?? undefined,
          country: location.country,
        },
        geo:
          location.latitude != null && location.longitude != null
            ? { latitude: location.latitude, longitude: location.longitude }
            : undefined,
      }),
    ],
  };
}

export function generateSchemaForPage(
  page: Page,
  site: Site,
  author?: Author
): JsonLd {
  const baseUrl = site.domain ? `https://${site.domain}` : "";
  const url = baseUrl ? `${baseUrl}/${page.slug}` : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url ? `${url}#webpage` : undefined,
        name: page.title,
        description: page.metaDescription ?? page.excerpt ?? undefined,
        url,
        datePublished: page.publishedAt?.toISOString() ?? undefined,
        dateModified: page.updatedAt?.toISOString() ?? undefined,
        author: author ? generatePerson(author) : undefined,
        isPartOf: {
          "@type": "WebSite",
          name: site.name,
          url: baseUrl || undefined,
        },
      },
      generateBreadcrumb(page, site, "page"),
    ],
  };
}
