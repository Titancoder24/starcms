export type PageSpeedResult = {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  lcpMs: number;
  inpMs: number;
  cls: string;
  ttfbMs: number;
};

export async function runPageSpeed(
  url: string,
  apiKey?: string
): Promise<PageSpeedResult | null> {
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  if (apiKey) endpoint.searchParams.set("key", apiKey);

  try {
    const res = await fetch(endpoint.toString(), {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: {
          performance?: { score?: number };
          seo?: { score?: number };
          accessibility?: { score?: number };
          "best-practices"?: { score?: number };
        };
        audits?: {
          "largest-contentful-paint"?: { numericValue?: number };
          "total-blocking-time"?: { numericValue?: number };
          "cumulative-layout-shift"?: { displayValue?: string };
          "server-response-time"?: { numericValue?: number };
        };
      };
    };

    const cats = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;

    return {
      performanceScore: Math.round((cats?.performance?.score ?? 0) * 100),
      seoScore: Math.round((cats?.seo?.score ?? 0) * 100),
      accessibilityScore: Math.round((cats?.accessibility?.score ?? 0) * 100),
      bestPracticesScore: Math.round(
        (cats?.["best-practices"]?.score ?? 0) * 100
      ),
      lcpMs: Math.round(
        audits?.["largest-contentful-paint"]?.numericValue ?? 0
      ),
      inpMs: Math.round(
        audits?.["total-blocking-time"]?.numericValue ?? 0
      ),
      cls:
        audits?.["cumulative-layout-shift"]?.displayValue ?? "0",
      ttfbMs: Math.round(
        audits?.["server-response-time"]?.numericValue ?? 0
      ),
    };
  } catch {
    return null;
  }
}
