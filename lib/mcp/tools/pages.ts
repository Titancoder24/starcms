import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import * as PagesApi from "@/lib/api/pages";
import { PageInputSchema } from "@/lib/api/pages";

export const pageTools = [
  {
    name: "list_pages",
    description: "List pages for a site.",
    inputSchema: z.object({
      status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return PagesApi.listPages(ctx.siteId, input as Parameters<typeof PagesApi.listPages>[1]);
    },
  },
  {
    name: "get_page",
    description: "Get a page by ID.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return PagesApi.getPage(input.id, ctx.siteId);
    },
  },
  {
    name: "create_page",
    description: "Create a new draft page.",
    inputSchema: PageInputSchema,
    async handler(input: z.infer<typeof PageInputSchema>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PagesApi.createPage(ctx.siteId, input);
    },
  },
  {
    name: "update_page",
    description: "Update a page.",
    inputSchema: z.object({ id: z.string().uuid(), patch: PageInputSchema.partial() }),
    async handler(input: { id: string; patch: Partial<z.infer<typeof PageInputSchema>> }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PagesApi.updatePage(input.id, ctx.siteId, input.patch);
    },
  },
  {
    name: "delete_page",
    description: "Delete a page.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "admin");
      await PagesApi.deletePage(input.id, ctx.siteId);
      return { ok: true };
    },
  },
  {
    name: "publish_page",
    description: "Publish a page.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PagesApi.publishPage(input.id, ctx.siteId);
    },
  },
];
