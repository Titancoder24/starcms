import type { GuardResult, PostForCheck } from "./types";

export function checkMetaTitle({ post }: PostForCheck): GuardResult {
  const title = (post.metaTitle ?? post.title ?? "").trim();
  const len = title.length;
  const pass = len >= 30 && len <= 60;
  return {
    code: "meta-title",
    pass,
    severity: "error",
    message: pass
      ? "Meta title is within the 30–60 character range."
      : `Meta title is ${len} characters (must be 30–60). ${len < 30 ? "Too short" : "Too long"}.`,
    fix: pass
      ? ""
      : len < 30
      ? "Expand the meta title to include your primary keyword and make it at least 30 characters."
      : "Shorten the meta title to under 60 characters by removing filler words.",
  };
}
