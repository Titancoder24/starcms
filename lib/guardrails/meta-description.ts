import type { GuardResult, PostForCheck } from "./types";

export function checkMetaDescription({ post }: PostForCheck): GuardResult {
  const desc = (post.metaDescription ?? "").trim();
  const len = desc.length;
  const pass = len >= 120 && len <= 160;
  return {
    code: "meta-description",
    pass,
    severity: "error",
    message: pass
      ? "Meta description is within the 120–160 character range."
      : `Meta description is ${len} characters (must be 120–160). ${len === 0 ? "Missing." : len < 120 ? "Too short." : "Too long."}`,
    fix: pass
      ? ""
      : len === 0
      ? "Add a meta description that summarises the post and includes the primary keyword."
      : len < 120
      ? "Expand the meta description to at least 120 characters, adding context and a call-to-action."
      : "Trim the meta description to under 160 characters — search engines will truncate it otherwise.",
  };
}
