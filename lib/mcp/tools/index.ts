import { postTools } from "./posts";
import { pageTools } from "./pages";
import { mediaTools } from "./media";
import { auditTools } from "./audit";
import { programmaticTools } from "./programmatic";
import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import * as AuthorsApi from "@/lib/api/authors";
import * as TaxonomyApi from "@/lib/api/taxonomy";
import * as SitesApi from "@/lib/api/sites";
import { requireScope } from "@/lib/auth/api-key";
import { listRedirects, createRedirect, deleteRedirect } from "@/lib/api/redirects";
import { generateSchemaForPost } from "@/lib/schema-ld";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { computeEmbedding, cosineSimilarity } from "@/lib/util/similarity";

type Tool = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: Record<string, unknown>, ctx: ApiKeyContext) => Promise<unknown>;
};

const siteTools: Tool[] = [
  {
    name: "list_sites",
    description: "List all sites for the authenticated user.",
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      requireScope(ctx, "read");
      return SitesApi.listSites(ctx.userId);
    },
  },
  {
    name: "get_site",
    description: "Get details for the current site.",
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      requireScope(ctx, "read");
      return SitesApi.getSite(ctx.siteId, ctx.userId);
    },
  },
  {
    name: "update_site_settings",
    description: "Update site settings (name, domain, verification tokens, etc.).",
    inputSchema: z.object({
      name: z.string().optional(),
      domain: z.string().optional(),
    }),
    async handler(input, ctx) {
      requireScope(ctx, "admin");
      return SitesApi.updateSiteSettings(ctx.siteId, ctx.userId, input as never);
    },
  },
];

const authorTools: Tool[] = [
  {
    name: "list_authors",
    description: "List authors for the site.",
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      requireScope(ctx, "read");
      return AuthorsApi.listAuthors(ctx.siteId);
    },
  },
  {
    name: "get_author",
    description: "Get an author by ID.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "read");
      return AuthorsApi.getAuthor(input["id"] as string, ctx.siteId);
    },
  },
  {
    name: "create_author",
    description: "Create an author.",
    inputSchema: AuthorsApi.AuthorInputSchema,
    async handler(input, ctx) {
      requireScope(ctx, "write");
      return AuthorsApi.createAuthor(ctx.siteId, input as z.infer<typeof AuthorsApi.AuthorInputSchema>);
    },
  },
  {
    name: "update_author",
    description: "Update an author.",
    inputSchema: z.object({ id: z.string().uuid(), patch: AuthorsApi.AuthorInputSchema.partial() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "write");
      return AuthorsApi.updateAuthor(
        input["id"] as string,
        ctx.siteId,
        input["patch"] as Partial<z.infer<typeof AuthorsApi.AuthorInputSchema>>
      );
    },
  },
];

const taxonomyTools: Tool[] = [
  {
    name: "list_tags",
    description: "List all tags.",
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      requireScope(ctx, "read");
      return TaxonomyApi.listTags(ctx.siteId);
    },
  },
  {
    name: "create_tag",
    description: "Create a tag.",
    inputSchema: z.object({ name: z.string(), slug: z.string().optional() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "write");
      return TaxonomyApi.createTag(ctx.siteId, input as { name: string; slug?: string });
    },
  },
  {
    name: "list_categories",
    description: "List all categories.",
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      requireScope(ctx, "read");
      return TaxonomyApi.listCategories(ctx.siteId);
    },
  },
  {
    name: "create_category",
    description: "Create a category.",
    inputSchema: z.object({ name: z.string(), slug: z.string().optional(), parentId: z.string().uuid().optional() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "write");
      return TaxonomyApi.createCategory(ctx.siteId, input as { name: string; slug?: string; parentId?: string });
    },
  },
];

const redirectTools: Tool[] = [
  {
    name: "list_redirects",
    description: "List URL redirects for the site.",
    inputSchema: z.object({}),
    async handler(_input, ctx) {
      requireScope(ctx, "read");
      return listRedirects(ctx.siteId);
    },
  },
  {
    name: "create_redirect",
    description: "Create a URL redirect.",
    inputSchema: z.object({
      fromPath: z.string(),
      toPath: z.string(),
      statusCode: z.number().optional(),
    }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "write");
      return createRedirect(ctx.siteId, input as { fromPath: string; toPath: string; statusCode?: number });
    },
  },
  {
    name: "delete_redirect",
    description: "Delete a redirect.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "admin");
      await deleteRedirect(input["id"] as string, ctx.siteId);
      return { ok: true };
    },
  },
];

const schemaTools: Tool[] = [
  {
    name: "generate_schema",
    description: "Generate and validate JSON-LD schema for a post.",
    inputSchema: z.object({ postId: z.string().uuid() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "read");
      const post = await db.query.posts.findFirst({
        where: (p) => and(eq(p.id, input["postId"] as string), eq(p.siteId, ctx.siteId)),
        with: { site: true, author: true },
      });
      if (!post?.site) throw new Error("Post not found");
      return generateSchemaForPost(post, post.site, post.author ?? undefined);
    },
  },
  {
    name: "check_duplicate",
    description: "Check if content is a duplicate of existing published posts.",
    inputSchema: z.object({ content: z.string() }),
    async handler(input: Record<string, unknown>, ctx) {
      requireScope(ctx, "read");
      const embedding = await computeEmbedding(input["content"] as string);
      const published = await db
        .select({ id: posts.id, embedding: posts.embedding })
        .from(posts)
        .where(and(eq(posts.siteId, ctx.siteId), eq(posts.status, "published")));
      let maxSim = 0;
      for (const p of published) {
        if (!Array.isArray(p.embedding) || p.embedding.length === 0) continue;
        const sim = cosineSimilarity(embedding, p.embedding as number[]);
        if (sim > maxSim) maxSim = sim;
      }
      return {
        similarity: Math.round(maxSim * 100),
        isDuplicate: maxSim >= 0.92,
        isNearDuplicate: maxSim >= 0.85,
      };
    },
  },
];

export const allTools: Tool[] = [
  ...siteTools,
  ...(postTools as unknown as Tool[]),
  ...(pageTools as unknown as Tool[]),
  ...(mediaTools as unknown as Tool[]),
  ...authorTools,
  ...taxonomyTools,
  ...(auditTools as unknown as Tool[]),
  ...(programmaticTools as unknown as Tool[]),
  ...redirectTools,
  ...schemaTools,
];
