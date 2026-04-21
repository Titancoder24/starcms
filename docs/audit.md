# Audit System Reference

## Overview

Every published URL in StarCMS is automatically audited. The audit system fans out four parallel checks and stores results as a `audit_runs` row.

## Audit sources

- **manual** — triggered by the "Re-audit" button in the dashboard or the `run_audit` MCP tool
- **publish** — triggered automatically when a post is published (v0.1 TODO: wired post-publish)
- **cron** — triggered by the worker on a 6-hour schedule across all sites

## Checks performed

### 1. PageSpeed Insights

Calls Google's PageSpeed Insights API (`/pagespeedonline/v5/runPagespeed?strategy=mobile`). Captures:
- Performance, SEO, Accessibility, Best Practices scores (0–100)
- LCP (Largest Contentful Paint in ms)
- INP (Interaction to Next Paint in ms)
- CLS (Cumulative Layout Shift, display value)
- TTFB (Time to First Byte in ms)

**API key:** Configure in Settings → Site → PageSpeed API Key. Without a key, calls use the unauthenticated endpoint (heavily rate-limited). Get a free key from Google Cloud Console.

### 2. Link checker

Fetches the live HTML, extracts all `href` and `src` attributes, and HEAD-checks each external URL. Falls back to GET if HEAD returns 405. 5 concurrent checks.

### 3. Schema validator

Fetches the live HTML and extracts all `<script type="application/ld+json">` blocks. Validates presence of `@context` and `@type`.

### 4. AI Readiness

Checks 8 signals (each worth ~12.5 points):
1. **llms.txt** — is `/llms.txt` reachable at the site root?
2. **JSON-LD schema** — is `application/ld+json` present?
3. **Semantic HTML** — are ≥ 4 of 10 semantic HTML5 elements used?
4. **FAQ/HowTo** — is FAQ or Q&A content present?
5. **Word count** — is the page ≥ 300 words?
6. **Reading level** — is Flesch score ≥ 40?
7. **E-E-A-T author** — is author attribution present?
8. **Open Graph** — are OG meta tags present?

## Status thresholds

| Status | Criteria |
|--------|----------|
| `green` | Performance ≥ 90 AND SEO ≥ 95 AND zero broken links AND AI Readiness ≥ 80 |
| `red` | Performance < 50 OR SEO < 70 OR broken links > 3 |
| `yellow` | Everything else |

## Dashboard

**Admin → Audit** shows all audit runs with one-click drilldown. Each run shows:
- Per-check scores
- Full issue list with severity and specific fix instructions
- Broken link list with status codes
- AI readiness breakdown

## Fix workflow with an LLM agent

1. Connect your LLM client to the MCP server.
2. Say: *"List broken pages, find the three worst, and suggest fixes for each."*
3. The LLM calls `list_broken_pages` → `get_audit` per URL → `suggest_fixes` per URL.
4. Fixes are returned as structured JSON. The LLM can apply them via `update_post` and re-run `publish_post`.
