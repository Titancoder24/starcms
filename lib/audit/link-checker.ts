export type LinkCheckResult = {
  href: string;
  status: number;
};

async function checkUrl(href: string): Promise<LinkCheckResult> {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { href, status: 0 };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(href, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (res.status === 405) {
        // Try GET if HEAD not allowed
        const getRes = await fetch(href, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
        });
        return { href, status: getRes.status };
      }
      return { href, status: res.status };
    } catch {
      clearTimeout(timeout);
      return { href, status: 0 };
    }
  } catch {
    return { href, status: 0 };
  }
}

export async function checkLinks(
  html: string,
  concurrency = 5
): Promise<{ brokenLinks: LinkCheckResult[]; brokenImages: LinkCheckResult[] }> {
  // Extract all href links
  const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi);
  const imgMatches = html.matchAll(/src=["']([^"']+)["']/gi);

  const linkUrls = new Set<string>();
  const imgUrls = new Set<string>();

  for (const m of linkMatches) {
    const href = m[1];
    if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      linkUrls.add(href);
    }
  }
  for (const m of imgMatches) {
    const src = m[1];
    if (src && (src.startsWith("http://") || src.startsWith("https://"))) {
      imgUrls.add(src);
    }
  }

  const checkBatch = async (
    urls: string[]
  ): Promise<LinkCheckResult[]> => {
    const broken: LinkCheckResult[] = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(checkUrl));
      for (const r of results) {
        if (r.status === 0 || r.status >= 400) {
          broken.push(r);
        }
      }
    }
    return broken;
  };

  const [brokenLinks, brokenImages] = await Promise.all([
    checkBatch(Array.from(linkUrls)),
    checkBatch(Array.from(imgUrls)),
  ]);

  return { brokenLinks, brokenImages };
}
