# Guardrails Reference

StarCMS enforces 11 pre-publish checks on every post. A post cannot be published while any **error-severity** check is failing. Warnings are surfaced but do not block publishing.

## How guardrails work

Guardrails run in two places:
1. **Live in the editor** — debounced at 500ms as you type, shown in the Guardrails sidebar tab.
2. **At publish time** — enforced server-side before `status` is set to `published`. No client-side bypass is possible.

The MCP `publish_post` tool also respects guardrails and returns a structured `guardrail-failed` error with the full issue list so an LLM agent can iterate.

---

## Guardrail 1: meta-title

**Code:** `meta-title`  
**Severity:** error  
**Rule:** Meta title must be 30–60 characters (after trim).  
**Rationale:** Titles shorter than 30 characters lack keyword richness. Titles over 60 characters are truncated by Google, reducing CTR.  
**Override:** Not overridable — this is a hard SEO best practice.

---

## Guardrail 2: meta-description

**Code:** `meta-description`  
**Severity:** error  
**Rule:** Meta description must be 120–160 characters.  
**Rationale:** Descriptions shorter than 120 characters are thin and often auto-generated. Descriptions over 160 characters are truncated.

---

## Guardrail 3: single-h1

**Code:** `single-h1`  
**Severity:** error  
**Rule:** The post body must contain at most one H1. The post title is treated as the page's H1.  
**Rationale:** Multiple H1 tags confuse search engines about the primary topic.

---

## Guardrail 4: heading-hierarchy

**Code:** `heading-hierarchy`  
**Severity:** error  
**Rule:** Heading levels must not skip (H2 → H4 is invalid; H2 → H3 is valid).  
**Rationale:** Skipped heading levels break document outline semantics and assistive technology navigation.

---

## Guardrail 5: alt-text

**Code:** `alt-text`  
**Severity:** error  
**Rule:** Every `<img>` and `<Image>` tag must have a non-empty `alt` attribute that is not a filename.  
**Rationale:** Missing or filename-like alt text fails accessibility standards (WCAG 2.1) and misses image search keywords.

---

## Guardrail 6: canonical

**Code:** `canonical`  
**Severity:** error  
**Rule:** If a canonical URL is set, it must be a valid absolute URL with `http` or `https` protocol.  
**Rationale:** Invalid canonicals confuse crawlers and may cause incorrect de-indexing.  
**Override:** Leave blank to default to the page's self-URL (recommended for original content).

---

## Guardrail 7: schema-valid

**Code:** `schema-valid`  
**Severity:** error  
**Rule:** The JSON-LD generated for the post must pass shape validation (presence of `@context` and `@type`, valid author and publisher structure).  
**Rationale:** Invalid structured data is ignored by search engines and fails rich result eligibility.

---

## Guardrail 8: min-words

**Code:** `min-words`  
**Severity:** error  
**Rule:** Post body must contain at least 300 words (default). Pages: 100 words (default).  
**Rationale:** Thin content rarely ranks and often triggers quality filters.  
**Override:** Configurable per site in Settings → Site → Content Thresholds (`minWordCounts.post`, `minWordCounts.page`).

---

## Guardrail 9: internal-links

**Code:** `internal-links`  
**Severity:** error (outbound) / warn (inbound)  
**Rule:** Post must link to at least 2 other published posts/pages on the site. Warns (does not error) if no inbound links exist (expected for new posts).  
**Rationale:** Internal linking distributes PageRank and helps crawlers discover content.

---

## Guardrail 10: readability

**Code:** `readability`  
**Severity:** error  
**Rule:** Flesch Reading Ease score must be ≥ 50 (default).  
**Rationale:** Content below Flesch 50 is difficult to read for most adults, reducing dwell time and user satisfaction.  
**Override:** Configurable per site in Settings → Site → Content Thresholds (`readabilityThreshold`). Technical documentation sites may lower this threshold.

---

## Guardrail 11: no-duplicate

**Code:** `no-duplicate`  
**Severity:** error at ≥ 92% similarity, warn at ≥ 85%  
**Rule:** Post content must not be too similar to existing published posts (measured by cosine similarity of text embeddings using `all-MiniLM-L6-v2`).  
**Rationale:** Duplicate and near-duplicate content causes keyword cannibalization and may trigger thin-content filters.  
**Note:** The first time this guardrail runs, the embedding model downloads (~23MB) from HuggingFace. Subsequent runs use the cached model.
