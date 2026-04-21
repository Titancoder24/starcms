import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import { db } from "@/lib/db/client";
import { locations, entities, ctas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { slugify } from "@/lib/util/slugify";
import { generateGeoPage, batchGeoPages } from "@/lib/programmatic/geo";
import { generateComparisonPage } from "@/lib/programmatic/comparison";
import { generateReviewPage } from "@/lib/programmatic/review";
import { generateMarketplacePage } from "@/lib/programmatic/marketplace";
import { createPost } from "@/lib/api/posts";
import { publishPost } from "@/lib/api/posts";
import { ApiError } from "@/lib/api/errors";

const LocationInputSchema = z.object({
  country: z.string().default("US"),
  region: z.string().optional(),
  city: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  population: z.number().int().optional(),
});

const EntityInputSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("product"),
  description: z.string().optional(),
  url: z.string().optional(),
  logoUrl: z.string().optional(),
  ratingValue: z.number().min(1).max(5).optional(),
  ratingCount: z.number().int().optional(),
  priceRange: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
});

export const geoTools = [
  // ── Locations ────────────────────────────────────────────────────────────────
  {
    name: "list_locations",
    description: "List all geo locations for the site.",
    inputSchema: z.object({}),
    async handler(_: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return db.select().from(locations).where(eq(locations.siteId, ctx.siteId));
    },
  },
  {
    name: "create_location",
    description: "Add a geo location dimension (city/region/country) for geo programmatic pages.",
    inputSchema: LocationInputSchema,
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const loc = input as z.infer<typeof LocationInputSchema>;
      const city = loc.city;
      const slug = slugify(`${city}${loc.region ? `-${loc.region}` : ""}-${loc.country}`);
      const rows = await db.insert(locations).values({ siteId: ctx.siteId, slug, ...loc }).returning();
      return rows[0];
    },
  },
  {
    name: "bulk_create_locations",
    description: "Bulk-import a list of locations from a JSON array. Each item must have city and country fields.",
    inputSchema: z.object({
      locations: z.array(LocationInputSchema).min(1).max(500),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const locs = (input as { locations: z.infer<typeof LocationInputSchema>[] }).locations;
      const rows = locs.map((l) => ({
        siteId: ctx.siteId,
        slug: slugify(`${l.city}${l.region ? `-${l.region}` : ""}-${l.country}`),
        ...l,
      }));
      const inserted = await db.insert(locations).values(rows).returning();
      return { created: inserted.length };
    },
  },

  // ── Geo page generation ────────────────────────────────────────────────────
  {
    name: "generate_geo_pages",
    description: "Generate '[keyword] in [city]' pages for a keyword × locations matrix. Returns generated post slugs.",
    inputSchema: z.object({
      keywords: z.array(z.string().min(1)).min(1).max(50),
      locationIds: z.array(z.string().uuid()).min(1).max(500),
      templateMdx: z.string().optional(),
      dryRun: z.boolean().default(false),
      publish: z.boolean().default(true),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const { keywords, locationIds, templateMdx, dryRun, publish } = input as {
        keywords: string[];
        locationIds: string[];
        templateMdx?: string;
        dryRun: boolean;
        publish: boolean;
      };

      const locs = await db
        .select()
        .from(locations)
        .where(and(eq(locations.siteId, ctx.siteId)));
      const locMap = new Map(locs.map((l) => [l.id, l]));
      const targetLocs = locationIds.map((id) => locMap.get(id)).filter(Boolean) as typeof locs;

      const results: Array<{ slug: string; status: string }> = [];
      for (const page of batchGeoPages(targetLocs, keywords, templateMdx ?? "")) {
        if (dryRun) {
          results.push({ slug: page.slug, status: "dry-run" });
          continue;
        }
        try {
          const post = await createPost(ctx.siteId, {
            slug: page.slug,
            title: page.title,
            mdxBody: page.mdxBody,
            metaTitle: page.metaTitle,
            metaDescription: page.metaDescription,
          });
          if (publish) await publishPost(post.id, ctx.siteId);
          results.push({ slug: page.slug, status: publish ? "published" : "draft" });
        } catch {
          results.push({ slug: page.slug, status: "failed" });
        }
      }
      return { total: results.length, results };
    },
  },

  // ── Entities ────────────────────────────────────────────────────────────────
  {
    name: "list_entities",
    description: "List all entities (products, services, tools) for comparison and review pages.",
    inputSchema: z.object({ type: z.string().optional() }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return db.select().from(entities).where(eq(entities.siteId, ctx.siteId));
    },
  },
  {
    name: "create_entity",
    description: "Create an entity (product, service, tool) for use in comparison, review, or marketplace pages.",
    inputSchema: EntityInputSchema,
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const e = input as z.infer<typeof EntityInputSchema>;
      const slug = slugify(e.name);
      const rows = await db.insert(entities).values({ siteId: ctx.siteId, slug, ...e }).returning();
      return rows[0];
    },
  },
  {
    name: "update_entity",
    description: "Update an entity's details.",
    inputSchema: z.object({ id: z.string().uuid(), patch: EntityInputSchema.partial() }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const { id, patch } = input as { id: string; patch: Partial<z.infer<typeof EntityInputSchema>> };
      const rows = await db
        .update(entities)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(entities.id, id), eq(entities.siteId, ctx.siteId)))
        .returning();
      if (!rows[0]) throw new ApiError("not-found", "Entity not found", 404);
      return rows[0];
    },
  },

  // ── Comparison pages ─────────────────────────────────────────────────────────
  {
    name: "generate_comparison_page",
    description: "Generate an 'A vs B' comparison page for 2+ entities. Returns the created post.",
    inputSchema: z.object({
      entityIds: z.array(z.string().uuid()).min(2).max(5),
      templateMdx: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      dryRun: z.boolean().default(false),
      publish: z.boolean().default(true),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const { entityIds, templateMdx, metaTitle, metaDescription, dryRun, publish } = input as {
        entityIds: string[];
        templateMdx?: string;
        metaTitle?: string;
        metaDescription?: string;
        dryRun: boolean;
        publish: boolean;
      };

      const entityRows = await db
        .select()
        .from(entities)
        .where(eq(entities.siteId, ctx.siteId));
      const entityMap = new Map(entityRows.map((e) => [e.id, e]));
      const selected = entityIds.map((id) => entityMap.get(id)).filter(Boolean) as typeof entityRows;
      if (selected.length < 2) throw new ApiError("bad-request", "At least 2 valid entity IDs required", 400);

      const page = generateComparisonPage(selected, { templateMdx, metaTitle, metaDescription });

      if (dryRun) return { ...page, status: "dry-run" };

      const post = await createPost(ctx.siteId, {
        slug: page.slug,
        title: page.title,
        mdxBody: page.mdxBody,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
      });
      if (publish) await publishPost(post.id, ctx.siteId);
      return { ...page, postId: post.id, status: publish ? "published" : "draft" };
    },
  },

  // ── Review pages ─────────────────────────────────────────────────────────────
  {
    name: "generate_review_page",
    description: "Generate a structured review page for an entity with Review + AggregateRating JSON-LD.",
    inputSchema: z.object({
      entityId: z.string().uuid(),
      reviewerName: z.string().optional(),
      verdict: z.string().optional(),
      whoItsFor: z.string().optional(),
      whoItsNotFor: z.string().optional(),
      templateMdx: z.string().optional(),
      dryRun: z.boolean().default(false),
      publish: z.boolean().default(true),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const { entityId, reviewerName, verdict, whoItsFor, whoItsNotFor, templateMdx, dryRun, publish } = input as {
        entityId: string;
        reviewerName?: string;
        verdict?: string;
        whoItsFor?: string;
        whoItsNotFor?: string;
        templateMdx?: string;
        dryRun: boolean;
        publish: boolean;
      };

      const entity = await db.query.entities.findFirst({
        where: (e) => and(eq(e.id, entityId), eq(e.siteId, ctx.siteId)),
      });
      if (!entity) throw new ApiError("not-found", "Entity not found", 404);

      const page = generateReviewPage(entity, { reviewerName, verdict, whoItsFor, whoItsNotFor, templateMdx });

      if (dryRun) return { ...page, status: "dry-run" };

      const post = await createPost(ctx.siteId, {
        slug: page.slug,
        title: page.title,
        mdxBody: page.mdxBody,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
      });
      if (publish) await publishPost(post.id, ctx.siteId);
      return { ...page, postId: post.id, status: publish ? "published" : "draft" };
    },
  },

  // ── Marketplace pages ────────────────────────────────────────────────────────
  {
    name: "generate_marketplace_page",
    description: "Generate a 'Best [topic] in [year]' marketplace/listing page with ranked entities and CTAs.",
    inputSchema: z.object({
      topic: z.string().min(1),
      entityIds: z.array(z.string().uuid()).min(1).max(20),
      featuredEntityIds: z.array(z.string().uuid()).optional(),
      intro: z.string().optional(),
      buyingGuide: z.string().optional(),
      dryRun: z.boolean().default(false),
      publish: z.boolean().default(true),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const { topic, entityIds, featuredEntityIds = [], intro, buyingGuide, dryRun, publish } = input as {
        topic: string;
        entityIds: string[];
        featuredEntityIds?: string[];
        intro?: string;
        buyingGuide?: string;
        dryRun: boolean;
        publish: boolean;
      };

      const allEntities = await db.select().from(entities).where(eq(entities.siteId, ctx.siteId));
      const allCtas = await db.select().from(ctas).where(eq(ctas.siteId, ctx.siteId));
      const entityMap = new Map(allEntities.map((e) => [e.id, e]));
      const ctasByEntity = new Map<string, typeof allCtas>();
      for (const c of allCtas) {
        if (c.entityId) {
          const arr = ctasByEntity.get(c.entityId) ?? [];
          arr.push(c);
          ctasByEntity.set(c.entityId, arr);
        }
      }

      const listings = entityIds
        .map((id) => entityMap.get(id))
        .filter(Boolean)
        .map((e) => ({
          entity: e!,
          ctas: ctasByEntity.get(e!.id) ?? [],
          featured: featuredEntityIds.includes(e!.id),
        }));

      const page = generateMarketplacePage(topic, listings, { intro, buyingGuide });

      if (dryRun) return { ...page, status: "dry-run" };

      const post = await createPost(ctx.siteId, {
        slug: page.slug,
        title: page.title,
        mdxBody: page.mdxBody,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
      });
      if (publish) await publishPost(post.id, ctx.siteId);
      return { ...page, postId: post.id, status: publish ? "published" : "draft" };
    },
  },

  // ── CTAs ────────────────────────────────────────────────────────────────────
  {
    name: "create_cta",
    description: "Create a call-to-action link for an entity (affiliate, visit, sign-up, etc.).",
    inputSchema: z.object({
      label: z.string().min(1),
      url: z.string().url(),
      type: z.enum(["button", "form", "phone", "email"]).default("button"),
      entityId: z.string().uuid().optional(),
      isAffiliate: z.boolean().default(false),
      affiliateDisclosure: z.string().optional(),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const ctaInput = input as { label: string; url: string; type: string; entityId?: string; isAffiliate: boolean; affiliateDisclosure?: string };
      const rows = await db.insert(ctas).values({ siteId: ctx.siteId, ...ctaInput }).returning();
      return rows[0];
    },
  },
  {
    name: "list_ctas",
    description: "List all CTAs for the site.",
    inputSchema: z.object({ entityId: z.string().uuid().optional() }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      const { entityId } = input as { entityId?: string };
      if (entityId) {
        return db.select().from(ctas).where(and(eq(ctas.siteId, ctx.siteId), eq(ctas.entityId, entityId)));
      }
      return db.select().from(ctas).where(eq(ctas.siteId, ctx.siteId));
    },
  },
];
