import type { GuardResult, PostForCheck } from "./types";

const IMG_REGEX = /!\[([^\]]*)\]\([^)]+\)|<(?:img|Image)[^>]+?alt=["']([^"']*)["'][^>]*>/gi;
const FILENAME_REGEX = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i;

export function checkAltText({ post }: PostForCheck): GuardResult {
  const issues: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = IMG_REGEX.exec(post.mdxBody)) !== null) {
    const alt = (match[1] ?? match[2] ?? "").trim();
    if (alt === "") {
      issues.push("Image with empty alt text found");
    } else if (FILENAME_REGEX.test(alt)) {
      issues.push(`Image alt text looks like a filename: "${alt}"`);
    }
  }

  const pass = issues.length === 0;
  return {
    code: "alt-text",
    pass,
    severity: "error",
    message: pass
      ? "All images have descriptive alt text."
      : `${issues.length} image(s) have missing or filename-like alt text: ${issues.slice(0, 3).join("; ")}`,
    fix: pass
      ? ""
      : 'Add meaningful alt text to every image. Describe what the image shows. Use alt="" only for purely decorative images.',
  };
}
