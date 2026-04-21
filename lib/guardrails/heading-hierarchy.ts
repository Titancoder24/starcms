import type { GuardResult, PostForCheck } from "./types";

export function checkHeadingHierarchy({ post }: PostForCheck): GuardResult {
  const headingRegex = /^(#{1,6})\s+.+/gm;
  const levels: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(post.mdxBody)) !== null) {
    if (match[1]) levels.push(match[1].length);
  }

  if (levels.length === 0) {
    return { code: "heading-hierarchy", pass: true, severity: "error", message: "No headings found.", fix: "" };
  }

  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1] ?? 1;
    const curr = levels[i] ?? prev;
    if (curr > prev + 1) {
      return {
        code: "heading-hierarchy",
        pass: false,
        severity: "error",
        message: `Skipped heading level: H${prev} jumps directly to H${curr}. Heading levels should not skip (e.g., H2 → H4 is invalid).`,
        fix: `Change the H${curr} heading to H${prev + 1}. Review all headings for logical nesting.`,
      };
    }
  }

  return { code: "heading-hierarchy", pass: true, severity: "error", message: "Heading hierarchy is valid.", fix: "" };
}
