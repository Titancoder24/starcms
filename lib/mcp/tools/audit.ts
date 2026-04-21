import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import * as AuditApi from "@/lib/api/audit";
import { listBrokenPages } from "@/lib/audit/orchestrator";

export const auditTools = [
  {
    name: "run_audit",
    description: "Run an SEO audit on a URL (PageSpeed, links, schema, AI readiness).",
    inputSchema: z.object({
      url: z.string().url(),
      postId: z.string().uuid().optional(),
      pageId: z.string().uuid().optional(),
    }),
    async handler(input: { url: string; postId?: string; pageId?: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return AuditApi.triggerAudit(input.url, ctx.siteId, input.postId, input.pageId);
    },
  },
  {
    name: "get_audit",
    description: "Get the most recent audit result for a URL.",
    inputSchema: z.object({ url: z.string().url() }),
    async handler(input: { url: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return AuditApi.getAudit(input.url, ctx.siteId);
    },
  },
  {
    name: "list_broken_pages",
    description: "List pages with red or yellow audit status.",
    inputSchema: z.object({
      severity: z.enum(["red", "yellow"]).optional(),
    }),
    async handler(input: { severity?: "red" | "yellow" }, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return listBrokenPages(ctx.siteId, input.severity);
    },
  },
  {
    name: "suggest_fixes",
    description: "Use AI to suggest specific fixes for audit issues on a page.",
    inputSchema: z.object({ url: z.string().url() }),
    async handler(input: { url: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return AuditApi.suggestFixes(input.url, ctx.siteId, ctx.userId);
    },
  },
];
