import { db } from "@/lib/db/client";
import { auditRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { runAudit } from "@/lib/audit/orchestrator";
import type { AuditRun } from "@/lib/db/schema";
import { ApiError } from "./errors";
import { chat } from "@/lib/ai/openrouter";
import { z } from "zod/v4";

export async function listAuditRuns(
  siteId: string,
  opts: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ items: AuditRun[]; hasMore: boolean }> {
  const { limit = 50, offset = 0 } = opts;
  const rows = await db
    .select()
    .from(auditRuns)
    .where(eq(auditRuns.siteId, siteId))
    .orderBy(desc(auditRuns.runAt))
    .limit(limit + 1)
    .offset(offset);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getAudit(url: string, siteId: string): Promise<AuditRun | null> {
  const rows = await db
    .select()
    .from(auditRuns)
    .where(and(eq(auditRuns.url, url), eq(auditRuns.siteId, siteId)))
    .orderBy(desc(auditRuns.runAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function triggerAudit(
  url: string,
  siteId: string,
  postId?: string,
  pageId?: string
): Promise<AuditRun> {
  return runAudit({ url, siteId, postId, pageId, source: "manual" });
}

export async function suggestFixes(
  url: string,
  siteId: string,
  userId: string
): Promise<Array<{ issue: string; fix: string; priority: "high" | "medium" | "low" }>> {
  const audit = await getAudit(url, siteId);
  if (!audit) throw new ApiError("not-found", "No audit found for this URL", 404);

  const issuesSummary = (audit.issues ?? [])
    .slice(0, 10)
    .map((i) => `- [${i.severity}] ${i.message}`)
    .join("\n");

  const FixSchema = z.object({
    fixes: z.array(
      z.object({
        issue: z.string(),
        fix: z.string(),
        priority: z.enum(["high", "medium", "low"]),
      })
    ),
  });

  const result = await chat(userId, siteId, {
    messages: [
      {
        role: "system",
        content:
          "You are an SEO specialist. Given audit issues, provide specific, actionable fixes in JSON format.",
      },
      {
        role: "user",
        content: `URL: ${url}\n\nAudit issues:\n${issuesSummary}\n\nReturn a JSON object with a "fixes" array. Each fix has: issue (string), fix (specific actionable steps), priority (high/medium/low).`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(result.content) as unknown;
    const validated = FixSchema.parse(parsed);
    return validated.fixes;
  } catch {
    return (audit.issues ?? []).map((i) => ({
      issue: i.message,
      fix: i.fix,
      priority: i.severity === "error" ? "high" : "medium" as "high" | "medium" | "low",
    }));
  }
}
