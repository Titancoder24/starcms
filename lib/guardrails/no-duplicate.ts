import type { GuardResult, PostForCheck } from "./types";
import { computeEmbedding, cosineSimilarity } from "@/lib/util/similarity";

const ERROR_THRESHOLD = 0.92;
const WARN_THRESHOLD = 0.85;

export async function checkNoDuplicate({
  post,
  allPublishedPosts,
}: PostForCheck): Promise<GuardResult> {
  if (allPublishedPosts.length === 0) {
    return { code: "no-duplicate", pass: true, severity: "error", message: "No published posts to compare against.", fix: "" };
  }

  const embedding = await computeEmbedding(post.mdxBody);
  if (embedding.length === 0) {
    return {
      code: "no-duplicate",
      pass: true,
      severity: "warn",
      message: "Embedding model unavailable — duplicate check skipped.",
      fix: "",
    };
  }

  let maxSimilarity = 0;
  for (const other of allPublishedPosts) {
    if (other.id === post.id) continue;
    const otherEmbedding = other.embedding;
    if (!Array.isArray(otherEmbedding) || otherEmbedding.length === 0) continue;
    const sim = cosineSimilarity(embedding, otherEmbedding as number[]);
    if (sim > maxSimilarity) maxSimilarity = sim;
  }

  if (maxSimilarity >= ERROR_THRESHOLD) {
    return {
      code: "no-duplicate",
      pass: false,
      severity: "error",
      message: `This post is ${Math.round(maxSimilarity * 100)}% similar to an existing published post. This exceeds the ${Math.round(ERROR_THRESHOLD * 100)}% duplicate threshold.`,
      fix: "Significantly differentiate this post's content. Cover a unique angle, add original research, or merge this post into the existing similar one.",
    };
  }

  if (maxSimilarity >= WARN_THRESHOLD) {
    return {
      code: "no-duplicate",
      pass: true,
      severity: "warn",
      message: `This post is ${Math.round(maxSimilarity * 100)}% similar to an existing post. Consider differentiating the content.`,
      fix: "Review similar posts and ensure this one offers distinctly different value to avoid keyword cannibalization.",
    };
  }

  return {
    code: "no-duplicate",
    pass: true,
    severity: "error",
    message: `Content is sufficiently unique (max similarity: ${Math.round(maxSimilarity * 100)}%).`,
    fix: "",
  };
}
