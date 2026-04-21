import type { GuardResult, PostForCheck } from "./types";
import { wordCount } from "@/lib/util/readability";

const DEFAULT_MIN_WORDS_POST = 300;
const DEFAULT_MIN_WORDS_PAGE = 100;

export function checkMinWords({ post, site }: PostForCheck): GuardResult {
  const minWords =
    site?.settings?.minWordCounts?.post ?? DEFAULT_MIN_WORDS_POST;
  const count = wordCount(post.mdxBody);
  const pass = count >= minWords;
  return {
    code: "min-words",
    pass,
    severity: "error",
    message: pass
      ? `Post has ${count} words (minimum is ${minWords}).`
      : `Post has only ${count} words. Minimum is ${minWords} words.`,
    fix: pass
      ? ""
      : `Add more content. Expand each section with examples, data, or explanations to reach at least ${minWords} words. Thin content is the #1 reason pages don't rank.`,
  };
}
