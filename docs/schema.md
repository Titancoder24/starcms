# Schema.org Reference

StarCMS automatically generates JSON-LD structured data for every published post and page.

## Types emitted

### Article (posts)

Every post generates an `Article` block:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Post Title",
      "description": "Meta description",
      "url": "https://site.com/p/post-slug",
      "datePublished": "2026-01-01T00:00:00.000Z",
      "dateModified": "2026-01-02T00:00:00.000Z",
      "author": { "@type": "Person", "name": "Author Name", ... },
      "publisher": { "@type": "Organization", "name": "Site Name", "logo": { ... } }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [...]
    }
  ]
}
```

### FAQPage (conditional)

If the post body contains a `<FAQ>` MDX component with `<FAQItem question="...">` children, a `FAQPage` block is appended to the graph:

```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is SEO?",
      "acceptedAnswer": { "@type": "Answer", "text": "SEO means..." }
    }
  ]
}
```

### HowTo (conditional)

If the post body contains a `<HowTo name="...">` with `<Step>` children:

```json
{
  "@type": "HowTo",
  "name": "How to Install X",
  "step": [
    { "@type": "HowToStep", "position": 1, "text": "First step..." }
  ]
}
```

### WebPage (pages)

Static pages generate `WebPage` instead of `Article`.

### BreadcrumbList (all content)

Every post and page gets a two-item breadcrumb: Home → Page Title.

### Organization (site-wide)

The `Organization` block is injected once in the public root layout, not per-page:

```json
{
  "@type": "Organization",
  "name": "Legal Company Name",
  "url": "https://site.com",
  "logo": { "@type": "ImageObject", "url": "https://site.com/logo.png" },
  "sameAs": ["https://twitter.com/company", "https://linkedin.com/company/..."]
}
```

Configure in **Settings → Site → Organization**.

### WebSite (site-wide)

Also injected in the root layout, includes a `SearchAction` potentialAction:

```json
{
  "@type": "WebSite",
  "name": "Site Name",
  "url": "https://site.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": { "@type": "EntryPoint", "urlTemplate": "https://site.com/search?q={search_term_string}" },
    "query-input": "required name=search_term_string"
  }
}
```

## Validation

All schema is validated at publish time (guardrail 7: `schema-valid`). The validation checks for required `@context` and `@type` fields and validates the author/publisher shapes. Invalid schema blocks the publish.
