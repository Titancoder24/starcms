import { db } from "@/lib/db/client";
import { auditRuns, sites, posts, pages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runPageSpeed } from "./pagespeed";
import { checkLinks } from "./link-checker";
import { checkAiReadiness } from "./ai-readiness";
import type { AuditRun } from "@/lib/db/schema";

export type AuditInput = {
  url: string;
  siteId: string;
  postId?: string;
  pageId?: string;
  source?: "cron" | "manual" | "publish";
};

export async function runAudit(input: AuditInput): Promise<AuditRun> {
  const site = await db.query.sites.findFirst({
    where: (s) => eq(s.id, input.siteId),
  });

  const apiKey = site?.settings?.pagespeeedApiKey as string | undefined;
  const baseUrl = site?.domain ? `https://${site.domain}` : "";

  // Fetch the live page HTML
  let html = "";
  try {
    const res = await fetch(input.url, {
      headers: { "User-Agent": "StarCMS-Audit/1.0" },
    });
    if (res.ok) html = await res.text();
  } catch { /* skip HTML checks if unreachable */ }

  // Fan out all checks in parallel
  const [psi, linkResult, aiReadiness] = await Promise.all([
    runPageSpeed(input.url, apiKey),
    html ? checkLinks(html, 5) : Promise.resolve({ brokenLinks: [], brokenImages: [] }),
    html ? checkAiReadiness(input.url, html, baseUrl) : Promise.resolve({ score: 0, details: [] }),
  ]);

  // Build issues list
  const issues: AuditRun["issues"] = [];

  if (psi) {
    if (psi.performanceScore < 50) {
      issues.push({
        code: "performance-low",
        severity: "error",
        message: `Performance score is ${psi.performanceScore}/100.`,
        fix: "Optimize images, reduce JavaScript, enable caching, and improve server response time.",
      });
    } else if (psi.performanceScore < 90) {
      issues.push({
        code: "performance-medium",
        severity: "warn",
        message: `Performance score is ${psi.performanceScore}/100.`,
        fix: "Consider optimizing LCP elements and reducing unused JavaScript.",
      });
    }
    if (psi.seoScore < 70) {
      issues.push({
        code: "seo-low",
        severity: "error",
        message: `SEO score is ${psi.seoScore}/100.`,
        fix: "Fix missing meta tags, improve heading structure, and ensure robots.txt is permissive.",
      });
    }
  }

  if (linkResult.brokenLinks.length > 0) {
    issues.push({
      code: "broken-links",
      severity: linkResult.brokenLinks.length > 3 ? "error" : "warn",
      message: `${linkResult.brokenLinks.length} broken link(s) found.`,
      fix: `Update or remove these broken links: ${linkResult.brokenLinks.slice(0, 3).map((l) => l.href).join(", ")}`,
    });
  }

  if (aiReadiness.score < 80) {
    issues.push({
      code: "ai-readiness-low",
      severity: "warn",
      message: `AI readiness score is ${aiReadiness.score}/100.`,
      fix: "Add JSON-LD schema, llms.txt, FAQ sections, and ensure author attribution is present.",
    });
  }

  // Compute status
  let status: "green" | "yellow" | "red" = "yellow";
  const perf = psi?.performanceScore ?? 0;
  const seo = psi?.seoScore ?? 0;
  const brokenCount = linkResult.brokenLinks.length;

  if (
    perf >= 90 &&
    seo >= 95 &&
    brokenCount === 0 &&
    aiReadiness.score >= 80
  ) {
    status = "green";
  } else if (perf < 50 || seo < 70 || brokenCount > 3) {
    status = "red";
  }

  const rows = await db
    .insert(auditRuns)
    .values({
      url: input.url,
      siteId: input.siteId,
      postId: input.postId,
      pageId: input.pageId,
      source: input.source ?? "manual",
      performanceScore: psi?.performanceScore,
      seoScore: psi?.seoScore,
      accessibilityScore: psi?.accessibilityScore,
      bestPracticesScore: psi?.bestPracticesScore,
      lcpMs: psi?.lcpMs,
      inpMs: psi?.inpMs,
      cls: psi?.cls,
      ttfbMs: psi?.ttfbMs,
      brokenLinks: linkResult.brokenLinks,
      brokenImages: linkResult.brokenImages.map((r) => ({ src: r.href, status: r.status })),
      aiReadinessScore: aiReadiness.score,
      issues,
      status,
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error("Failed to save audit run");
  return row;
}

export async function getLatestAudit(url: string): Promise<AuditRun | null> {
  const rows = await db
    .select()
    .from(auditRuns)
    .where(eq(auditRuns.url, url))
    .orderBy(auditRuns.runAt)
    .limit(1);
  return rows[0] ?? null;
}

export async function listBrokenPages(
  siteId: string,
  severity?: "red" | "yellow"
): Promise<AuditRun[]> {
  const conditions = [eq(auditRuns.siteId, siteId)];
  if (severity) conditions.push(eq(auditRuns.status, severity));
  else {
    // Return non-green by default
    const { inArray } = await import("drizzle-orm");
    return db
      .select()
      .from(auditRuns)
      .where(and(...conditions, inArray(auditRuns.status, ["red", "yellow"])));
  }
  return db.select().from(auditRuns).where(and(...conditions));
}
