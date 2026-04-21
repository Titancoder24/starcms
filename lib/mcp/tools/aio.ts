import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import { generateAIOPage, scoreAIO, wrapWithAIO, questionifyHeadings } from "@/lib/programmatic/aio";
import { scoreLLMSEO, enhanceForLLMSearch, buildLLMsEntry } from "@/lib/programmatic/llm-seo";
import { checkCompliance } from "@/lib/programmatic/guidelines";
import { crawlUrl, crawlBatch } from "@/lib/programmatic/crawler";
import { createPost } from "@/lib/api/posts";
import { publishPost } from "@/lib/api/posts";

export const aioTools = [
  // ── AIO content generation ─────────────────────────────────────────────────
  {
    name: "generate_aio_page",
    description:
      "Generate a fully AIO-optimised page structured for Google AI Overviews and LLM search. Includes direct-answer block, entity definitions, structured sections, and FAQ.",
    inputSchema: z.object({
      query: z.string().min(1),
      directAnswer: z.string().min(10),
      keyEntities: z
        .array(z.object({ term: z.string(), definition: z.string() }))
        .optional(),
      sections: z.array(
        z.object({ heading: z.string(), content: z.string() })
      ),
      faqs: z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      dryRun: z.boolean().default(false),
      publish: z.boolean().default(true),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      const opts = input as unknown as Parameters<typeof generateAIOPage>[0] & { dryRun: boolean; publish: boolean };
      const page = generateAIOPage(opts);

      if (opts.dryRun) return { ...page, status: "dry-run" };

      const post = await createPost(ctx.siteId, {
        slug: page.slug,
        title: page.title,
        mdxBody: page.mdxBody,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
      });
      if (opts.publish) await publishPost(post.id, ctx.siteId);
      return { ...page, postId: post.id, status: opts.publish ? "published" : "draft" };
    },
  },

  // ── AIO scoring ────────────────────────────────────────────────────────────
  {
    name: "score_aio",
    description: "Score a piece of MDX content for AI Overview readiness (0–100). Returns breakdown by signal.",
    inputSchema: z.object({ mdx: z.string().min(1) }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      return scoreAIO((input as { mdx: string }).mdx);
    },
  },

  // ── AIO wrap ───────────────────────────────────────────────────────────────
  {
    name: "wrap_with_aio",
    description: "Prepend an AIO-optimised preamble (direct answer + entity definitions) to existing MDX content.",
    inputSchema: z.object({
      mdx: z.string().min(1),
      query: z.string().min(1),
      directAnswer: z.string().min(10),
      keyEntities: z
        .array(z.object({ term: z.string(), definition: z.string() }))
        .optional(),
    }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      const { mdx, query, directAnswer, keyEntities } = input as {
        mdx: string;
        query: string;
        directAnswer: string;
        keyEntities?: Array<{ term: string; definition: string }>;
      };
      return wrapWithAIO(mdx, { query, directAnswer, keyEntities });
    },
  },

  // ── Question headings ──────────────────────────────────────────────────────
  {
    name: "questionify_headings",
    description: "Rewrite generic headings (Introduction, Overview, Benefits, etc.) to question format for better AIO/snippet capture.",
    inputSchema: z.object({ mdx: z.string().min(1), topic: z.string().min(1) }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      const { mdx, topic } = input as { mdx: string; topic: string };
      return { mdx: questionifyHeadings(mdx, topic) };
    },
  },

  // ── LLM-SEO scoring ────────────────────────────────────────────────────────
  {
    name: "score_llm_seo",
    description: "Score content for LLM search readiness (ChatGPT, Perplexity, Claude, Bing Copilot). Returns 0–100 with breakdown.",
    inputSchema: z.object({
      mdx: z.string().min(1),
      primaryEntity: z.string().optional(),
    }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      const { mdx, primaryEntity } = input as { mdx: string; primaryEntity?: string };
      return scoreLLMSEO(mdx, primaryEntity ? { primaryEntity } : undefined);
    },
  },

  // ── LLM-SEO enhance ───────────────────────────────────────────────────────
  {
    name: "enhance_for_llm_search",
    description: "Append LLM-SEO enhancements to MDX: related entity graph, source citations, author attribution.",
    inputSchema: z.object({
      mdx: z.string().min(1),
      primaryEntity: z.string().min(1),
      relatedEntities: z.array(z.string()).optional(),
      citations: z
        .array(z.object({ title: z.string(), url: z.string(), year: z.number().optional() }))
        .optional(),
      authorExpertise: z.string().optional(),
    }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      const opts = input as unknown as Parameters<typeof enhanceForLLMSearch>[1] & { mdx: string };
      return { mdx: enhanceForLLMSearch(opts.mdx, opts) };
    },
  },

  // ── Guidelines compliance ────────────────────────────────────────────────
  {
    name: "check_guidelines_compliance",
    description:
      "Check a page against Google Search Essentials, Bing Webmaster Guidelines, and E-E-A-T signals. Returns a compliance score and per-rule results.",
    inputSchema: z.object({
      title: z.string().min(1),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      canonical: z.string().optional(),
      slug: z.string().min(1),
      mdxBody: z.string().min(1),
      authorName: z.string().optional(),
      hasSchemaLD: z.boolean().optional(),
      isAIGenerated: z.boolean().optional(),
    }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      return checkCompliance(input as unknown as Parameters<typeof checkCompliance>[0]);
    },
  },

  // ── Web crawler ────────────────────────────────────────────────────────────
  {
    name: "crawl_url",
    description:
      "Crawl a URL and extract structured data: title, meta, H1/H2s, word count, links, JSON-LD, and OG tags. Respects robots.txt.",
    inputSchema: z.object({
      url: z.string().url(),
      respectRobots: z.boolean().default(true),
      timeoutMs: z.number().int().min(1000).max(30000).default(10000),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      const { url, respectRobots, timeoutMs } = input as { url: string; respectRobots: boolean; timeoutMs: number };
      return crawlUrl(url, { respectRobots, timeoutMs });
    },
  },
  {
    name: "crawl_batch",
    description: "Crawl up to 20 URLs in parallel and return structured data for each.",
    inputSchema: z.object({
      urls: z.array(z.string().url()).min(1).max(20),
      respectRobots: z.boolean().default(true),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      const { urls, respectRobots } = input as { urls: string[]; respectRobots: boolean };
      return crawlBatch(urls, { respectRobots });
    },
  },

  // ── LLMs.txt entry builder ─────────────────────────────────────────────────
  {
    name: "build_llms_entry",
    description: "Build a formatted llms.txt entry for a piece of content with entity tags.",
    inputSchema: z.object({
      title: z.string().min(1),
      url: z.string().url(),
      excerpt: z.string().optional(),
      primaryEntity: z.string().optional(),
      relatedEntities: z.array(z.string()).optional(),
    }),
    async handler(input: Record<string, unknown>, _ctx: ApiKeyContext) {
      return { entry: buildLLMsEntry(input as Parameters<typeof buildLLMsEntry>[0]) };
    },
  },
];
