import type { GuardResult, PostForCheck } from "./types";

function extractLinks(mdx: string): string[] {
  const hrefs: string[] = [];
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRegex.exec(mdx)) !== null) {
    if (m[2]) hrefs.push(m[2]);
  }
  return hrefs;
}

export function checkInternalLinks({ post, publishedPosts }: PostForCheck): GuardResult {
  const links = extractLinks(post.mdxBody);
  const internalLinks = links.filter((href) => href.startsWith("/") || href.startsWith("./"));

  // Check outbound links to published posts
  const outboundCount = internalLinks.filter((href) =>
    publishedPosts.some(
      (p) => p.id !== post.id && (href.includes(p.slug) || href === `/p/${p.slug}`)
    )
  ).length;

  // Check inbound links from other published posts
  const inboundCount = publishedPosts.filter(
    (p) =>
      p.id !== post.id &&
      extractLinks(p.mdxBody).some(
        (href) => href.includes(post.slug) || href === `/p/${post.slug}`
      )
  ).length;

  if (outboundCount >= 2) {
    if (inboundCount === 0) {
      return {
        code: "internal-links",
        pass: true,
        severity: "warn",
        message: `Good outbound internal links (${outboundCount}). No inbound links yet from other posts — this is expected for new posts.`,
        fix: "Link to this post from related published posts to build internal link equity.",
      };
    }
    return {
      code: "internal-links",
      pass: true,
      severity: "warn",
      message: `Internal linking looks good: ${outboundCount} outbound, ${inboundCount} inbound.`,
      fix: "",
    };
  }

  return {
    code: "internal-links",
    pass: false,
    severity: "error",
    message: `Post has only ${outboundCount} outbound internal link(s). Minimum is 2.`,
    fix: "Link to at least 2 other published posts within the content. Use descriptive anchor text containing the target page's primary keyword.",
  };
}
