import { db } from "@/lib/db/client";
import {
  programmaticTemplates,
  programmaticRuns,
  type ProgrammaticTemplate,
  type ProgrammaticRun,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ApiError } from "./errors";
import { runGuardrails } from "@/lib/guardrails";
import { createPost } from "./posts";
import { publishPost } from "./posts";
import { slugify } from "@/lib/util/slugify";

function interpolate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return row[key] ?? "";
  });
}

export async function createProgrammaticTemplate(
  siteId: string,
  input: {
    name: string;
    templateMdx: string;
    datasetUrl?: string;
    fieldMapping?: Record<string, string>;
  }
): Promise<ProgrammaticTemplate> {
  const rows = await db
    .insert(programmaticTemplates)
    .values({
      siteId,
      name: input.name,
      templateMdx: input.templateMdx,
      datasetUrl: input.datasetUrl,
      fieldMapping: input.fieldMapping ?? {},
    })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("internal", "Failed to create template", 500);
  return row;
}

export async function listProgrammaticRuns(
  templateId: string,
  siteId: string
): Promise<ProgrammaticRun[]> {
  const template = await db.query.programmaticTemplates.findFirst({
    where: (t) => and(eq(t.id, templateId), eq(t.siteId, siteId)),
  });
  if (!template) throw new ApiError("not-found", "Template not found", 404);
  return db
    .select()
    .from(programmaticRuns)
    .where(eq(programmaticRuns.templateId, templateId));
}

export async function runProgrammatic(
  templateId: string,
  siteId: string,
  dryRun = false
): Promise<ProgrammaticRun> {
  const template = await db.query.programmaticTemplates.findFirst({
    where: (t) => and(eq(t.id, templateId), eq(t.siteId, siteId)),
  });
  if (!template) throw new ApiError("not-found", "Template not found", 404);

  // Fetch dataset
  let dataset: Record<string, string>[] = [];
  if (template.datasetUrl) {
    try {
      const res = await fetch(template.datasetUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("json")) {
          const json = (await res.json()) as unknown;
          if (Array.isArray(json)) {
            dataset = json as Record<string, string>[];
          }
        } else {
          // CSV parse
          const text = await res.text();
          const lines = text.split("\n").filter(Boolean);
          const headers = lines[0]?.split(",").map((h) => h.trim()) ?? [];
          dataset = lines.slice(1).map((line) => {
            const values = line.split(",");
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
              row[h] = values[i]?.trim() ?? "";
            });
            return row;
          });
        }
      }
    } catch { /* use cached */ }
  }
  if (dataset.length === 0 && Array.isArray(template.datasetCached)) {
    dataset = template.datasetCached as Record<string, string>[];
  }

  const fm = (template.fieldMapping ?? {}) as Record<string, string>;
  const runRows = await db
    .insert(programmaticRuns)
    .values({
      templateId,
      totalRows: dataset.length,
      dryRun,
    })
    .returning();
  const run = runRows[0];
  if (!run) throw new ApiError("internal", "Failed to create run", 500);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const report: ProgrammaticRun["reportJson"] = [];

  // Get site + author for guardrails
  const site = await db.query.sites.findFirst({ where: (s) => eq(s.id, siteId) });
  const allPublished = await db
    .select({ id: programmaticTemplates.id, embedding: programmaticTemplates.fieldMapping })
    .from(programmaticTemplates)
    .where(eq(programmaticTemplates.siteId, siteId));

  for (let i = 0; i < dataset.length; i++) {
    const row = dataset[i] ?? {};
    const slugField = fm["slug"] ?? "slug";
    const titleField = fm["title"] ?? "title";
    const rawSlug = row[slugField] ?? slugify(row[titleField] ?? `item-${i}`);
    const slug = slugify(rawSlug);
    const title = row[titleField] ?? `Item ${i + 1}`;
    const mdxBody = interpolate(template.templateMdx, row);
    const metaTitle = fm["metaTitle"] ? row[fm["metaTitle"]] : undefined;
    const metaDescription = fm["metaDescription"] ? row[fm["metaDescription"]] : undefined;
    const excerpt = fm["excerpt"] ? row[fm["excerpt"]] : undefined;

    // Build a fake post for guardrail checking
    const fakePost = {
      id: `dry-run-${i}`,
      siteId,
      slug,
      title,
      mdxBody,
      metaTitle: metaTitle ?? title,
      metaDescription: metaDescription ?? excerpt ?? "",
      canonical: null,
      status: "draft" as const,
      publishedAt: null,
      scheduledAt: null,
      authorId: null,
      coverMediaId: null,
      seo: {},
      embedding: [],
      excerpt: excerpt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const guardResults = await runGuardrails({
      post: fakePost,
      site: site ?? null,
      author: null,
      allPublishedPosts: [],
      publishedPosts: [],
    });

    const errors = guardResults.filter((r) => !r.pass && r.severity === "error");

    if (errors.length > 0) {
      failed++;
      report.push({
        row: i,
        slug,
        status: "failed",
        issues: errors.map((e) => ({ code: e.code, message: e.message })),
      });
      continue;
    }

    if (!dryRun) {
      try {
        const post = await createPost(siteId, {
          slug,
          title,
          mdxBody,
          metaTitle: metaTitle ?? title,
          metaDescription: metaDescription ?? "",
          excerpt,
        });
        await publishPost(post.id, siteId);
        generated++;
        report.push({ row: i, slug, status: "generated" });
      } catch {
        failed++;
        report.push({ row: i, slug, status: "failed", issues: [{ code: "create-error", message: "Failed to create or publish post" }] });
      }
    } else {
      generated++;
      report.push({ row: i, slug, status: "generated" });
    }
  }

  const finishedRows = await db
    .update(programmaticRuns)
    .set({
      finishedAt: new Date(),
      generatedCount: generated,
      skippedCount: skipped,
      failedCount: failed,
      reportJson: report,
    })
    .where(eq(programmaticRuns.id, run.id))
    .returning();

  const finished = finishedRows[0];
  if (!finished) throw new ApiError("internal", "Failed to update run", 500);
  return finished;
}
