import { z } from "zod/v4";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { requireScope } from "@/lib/auth/api-key";
import {
  createProgrammaticTemplate,
  runProgrammatic,
  listProgrammaticRuns,
} from "@/lib/api/programmatic";

export const programmaticTools = [
  {
    name: "create_programmatic_template",
    description: "Create a programmatic SEO template with a dataset for bulk page generation.",
    inputSchema: z.object({
      name: z.string().min(1),
      templateMdx: z.string().min(1),
      datasetUrl: z.string().url().optional(),
      fieldMapping: z.record(z.string(), z.string()).optional(),
    }),
    async handler(input: {
      name: string;
      templateMdx: string;
      datasetUrl?: string;
      fieldMapping?: Record<string, string>;
    }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return createProgrammaticTemplate(ctx.siteId, input);
    },
  },
  {
    name: "run_programmatic",
    description: "Run a programmatic template to generate pages. Use dryRun=true to preview without publishing.",
    inputSchema: z.object({
      templateId: z.string().uuid(),
      dryRun: z.boolean().default(false),
    }),
    async handler(input: { templateId: string; dryRun: boolean }, ctx: ApiKeyContext) {
      requireScope(ctx, "write");
      return runProgrammatic(input.templateId, ctx.siteId, input.dryRun);
    },
  },
  {
    name: "list_programmatic_runs",
    description: "List programmatic run history for a template.",
    inputSchema: z.object({ templateId: z.string().uuid() }),
    async handler(input: { templateId: string }, ctx: ApiKeyContext) {
      requireScope(ctx, "read");
      return listProgrammaticRuns(input.templateId, ctx.siteId);
    },
  },
];
