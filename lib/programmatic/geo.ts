/**
 * Geo programmatic SEO engine.
 * Generates "[keyword] in [city]" pages with LocalBusiness JSON-LD.
 * Each page targets a unique (keyword × location) combination so every URL
 * is genuinely distinct — no thin-content duplication.
 */

import { slugify } from "@/lib/util/slugify";
import type { Location } from "@/lib/db/schema";

export interface GeoPageVars {
  keyword: string;
  keywordSlug: string;
  city: string;
  region: string;
  country: string;
  locationSlug: string;
  latitude?: number;
  longitude?: number;
  population?: number;
}

export interface GeoPageOutput {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  mdxBody: string;
}

/** Build the variable bag from a location row + keyword. */
export function buildGeoVars(location: Location, keyword: string): GeoPageVars {
  return {
    keyword,
    keywordSlug: slugify(keyword),
    city: location.city,
    region: location.region ?? "",
    country: location.country,
    locationSlug: location.slug,
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    population: location.population ?? undefined,
  };
}

/** Interpolate `{{var}}` tokens in a template string. */
export function interpolateGeo(template: string, vars: GeoPageVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key as keyof GeoPageVars];
    return v != null ? String(v) : "";
  });
}

/**
 * Generate a complete geo page from a template MDX and a location.
 * The template may use any {{var}} tokens defined in GeoPageVars.
 */
export function generateGeoPage(
  templateMdx: string,
  location: Location,
  keyword: string,
  overrides?: { metaTitle?: string; metaDescription?: string }
): GeoPageOutput {
  const vars = buildGeoVars(location, keyword);
  const regionSuffix = vars.region ? `, ${vars.region}` : "";
  const slug = `${vars.keywordSlug}-in-${vars.locationSlug}`;
  const title = `${keyword} in ${location.city}${regionSuffix}`;
  const metaTitle = overrides?.metaTitle ?? interpolateGeo(
    `Best {{keyword}} in {{city}}${regionSuffix} | {{country}}`,
    vars
  );
  const metaDescription = overrides?.metaDescription ?? interpolateGeo(
    `Looking for {{keyword}} in {{city}}? Discover top-rated options, compare providers, and find exactly what you need in {{city}}${regionSuffix}.`,
    vars
  );
  const mdxBody = templateMdx
    ? interpolateGeo(templateMdx, vars)
    : buildDefaultGeoBody(vars);

  return { slug, title, metaTitle, metaDescription, mdxBody };
}

function buildDefaultGeoBody(v: GeoPageVars): string {
  const regionSuffix = v.region ? `, ${v.region}` : "";
  return `# ${v.keyword} in ${v.city}${regionSuffix}

Find the best **${v.keyword}** services in ${v.city}${regionSuffix}. Whether you're a local resident or visiting, this guide covers everything you need.

## Why Choose Local ${v.keyword} in ${v.city}?

Local providers understand the unique needs of ${v.city} residents and offer faster response times, community trust, and area-specific expertise.

## How to Find the Best ${v.keyword} in ${v.city}

1. **Search locally** – Use location-specific search terms like "${v.keyword} near ${v.city}".
2. **Check reviews** – Look for verified reviews from ${v.city} customers.
3. **Compare pricing** – Get multiple quotes to ensure competitive rates.
4. **Verify credentials** – Confirm licences and certifications valid in ${v.region || v.country}.

## Frequently Asked Questions

<FAQ>
<FAQItem question="What is the best ${v.keyword} in ${v.city}?">
The best option depends on your specific needs, budget, and location within ${v.city}. We recommend comparing at least three providers before deciding.
</FAQItem>
<FAQItem question="How much does ${v.keyword} cost in ${v.city}?">
Prices vary by provider and scope of service. Request a free quote from local ${v.city} providers for an accurate estimate.
</FAQItem>
<FAQItem question="Are ${v.keyword} providers in ${v.city} licensed?">
Reputable providers in ${v.city}${regionSuffix} should hold all necessary local and state licences. Always ask to see credentials before hiring.
</FAQItem>
</FAQ>
`;
}

/** Batch: generate pages for every location × keyword combination. */
export function* batchGeoPages(
  locations: Location[],
  keywords: string[],
  templateMdx: string
): Generator<GeoPageOutput & { locationId: string; keyword: string }> {
  for (const loc of locations) {
    for (const kw of keywords) {
      const page = generateGeoPage(templateMdx, loc, kw);
      yield { ...page, locationId: loc.id, keyword: kw };
    }
  }
}
