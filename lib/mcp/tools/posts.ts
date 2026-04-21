import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import * as PostsApi from "@/lib/api/posts";
import { PostInputSchema } from "@/lib/api/posts";

export const postTools = [
  {
    name: "list_posts",
    description: "List posts for a site, optionally filtering by status or tag.",
    inputSchema: z.object({
      status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
      tag: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }),
    async handler(input: Record<string, unknown>, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return PostsApi.listPosts(ctx.siteId, input as Parameters<typeof PostsApi.listPosts>[1]);
    },
  },
  {
    name: "get_post",
    description: "Get a post by ID.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return PostsApi.getPost(input.id, ctx.siteId);
    },
  },
  {
    name: "create_post",
    description: "Create a new draft post.",
    inputSchema: PostInputSchema,
    async handler(input: z.infer<typeof PostInputSchema>, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PostsApi.createPost(ctx.siteId, input);
    },
  },
  {
    name: "update_post",
    description: "Update an existing post.",
    inputSchema: z.object({
      id: z.string().uuid(),
      patch: PostInputSchema.partial(),
    }),
    async handler(input: { id: string; patch: Partial<z.infer<typeof PostInputSchema>> }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PostsApi.updatePost(input.id, ctx.siteId, input.patch);
    },
  },
  {
    name: "delete_post",
    description: "Delete a post.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "admin");
      await PostsApi.deletePost(input.id, ctx.siteId);
      return { ok: true };
    },
  },
  {
    name: "publish_post",
    description: "Publish a post (runs all guardrails). Returns guardrail failures if any.",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PostsApi.publishPost(input.id, ctx.siteId);
    },
  },
  {
    name: "unpublish_post",
    description: "Unpublish a post (reverts to draft).",
    inputSchema: z.object({ id: z.string().uuid() }),
    async handler(input: { id: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PostsApi.unpublishPost(input.id, ctx.siteId);
    },
  },
  {
    name: "schedule_post",
    description: "Schedule a post for future publishing.",
    inputSchema: z.object({
      id: z.string().uuid(),
      scheduledAt: z.coerce.date(),
    }),
    async handler(input: { id: string; scheduledAt: Date }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return PostsApi.schedulePost(input.id, ctx.siteId, input.scheduledAt);
    },
  },
];
