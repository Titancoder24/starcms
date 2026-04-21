import type { GuardResult, PostForCheck } from "./types";

function countH1(mdx: string): number {
  const matches = mdx.match(/^#{1}\s+.+/gm);
  return matches ? matches.length : 0;
}

export function checkSingleH1({ post }: PostForCheck): GuardResult {
  const count = countH1(post.mdxBody);
  // Title serves as H1 — body should have 0 or 1 H1
  const pass = count <= 1;
  return {
    code: "single-h1",
    pass,
    severity: "error",
    message: pass
      ? "Heading structure is correct — at most one H1 in the body."
      : `Found ${count} H1 headings in the post body. There should be at most one (the title serves as the page H1).`,
    fix: pass
      ? ""
      : "Change extra H1 (#) headings to H2 (##) or lower. Keep only the most important heading as H1, or remove all body H1s and let the title serve as the H1.",
  };
}
