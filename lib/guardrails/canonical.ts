import type { GuardResult, PostForCheck } from "./types";

export function checkCanonical({ post }: PostForCheck): GuardResult {
  const canonical = post.canonical;
  if (!canonical) {
    return { code: "canonical", pass: true, severity: "error", message: "No canonical override — will default to self URL.", fix: "" };
  }

  let url: URL;
  try {
    url = new URL(canonical);
  } catch {
    return {
      code: "canonical",
      pass: false,
      severity: "error",
      message: `Canonical URL is not a valid absolute URL: "${canonical}"`,
      fix: "Set the canonical to a full absolute URL (e.g., https://example.com/post-slug) or leave it blank to default to the page's own URL.",
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      code: "canonical",
      pass: false,
      severity: "error",
      message: `Canonical URL uses unsupported protocol: "${url.protocol}"`,
      fix: "Use https:// as the canonical URL protocol.",
    };
  }

  return { code: "canonical", pass: true, severity: "error", message: "Canonical URL is valid.", fix: "" };
}
