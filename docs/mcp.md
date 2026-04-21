# MCP Server Reference

StarCMS exposes a full MCP (Model Context Protocol) server at `/api/mcp`. Connect any MCP-capable LLM client to drive your CMS conversationally.

## Endpoint

```
POST https://your-domain.com/api/mcp
Authorization: Bearer cms_live_<your-api-key>
```

## Authentication

Create API keys at **Admin → Settings → API Keys**. Three scope levels:
- `read` — list and get operations only
- `write` — create, update, publish, run audits
- `admin` — all operations including delete and site settings

## Rate limits

- 60 calls/minute per key
- 5,000 calls/day per key

---

## Connecting clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "starcms": {
      "command": "curl",
      "args": ["-s", "-X", "POST", "https://your-domain.com/api/mcp",
               "-H", "Authorization: Bearer cms_live_YOUR_KEY",
               "-H", "Content-Type: application/json",
               "-d", "@-"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "servers": {
    "starcms": {
      "url": "https://your-domain.com/api/mcp",
      "headers": {
        "Authorization": "Bearer cms_live_YOUR_KEY"
      }
    }
  }
}
```

### curl (any HTTP MCP client)

```bash
curl -X POST https://your-domain.com/api/mcp \
  -H "Authorization: Bearer cms_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_posts","arguments":{}},"id":1}'
```

---

## Example prompts

After connecting, say to your LLM:

- *"List all my draft posts and tell me which one is closest to being publishable."*
- *"Audit every published page on my site and show me the three worst ones with specific fixes."*
- *"Create a post titled 'Best CRM Tools for 2026' with a draft body, set the author to Jane Smith, add tag 'software', leave as draft."*
- *"For each page showing broken links, find the correct replacement URL and propose an edit."*
- *"Run a dry-run programmatic generation for template X and report which rows would fail guardrails."*

---

## Tools reference

### Site tools

#### `list_sites`
List all sites for the authenticated user.
- **Scope:** read
- **Input:** `{}`
- **Output:** `Site[]`

#### `get_site`
Get details for the current site.
- **Scope:** read
- **Input:** `{}`

#### `update_site_settings`
Update site name, domain, or other settings.
- **Scope:** admin
- **Input:** `{ name?: string, domain?: string }`

---

### Post tools

#### `list_posts`
- **Scope:** read
- **Input:** `{ status?: "draft"|"scheduled"|"published"|"archived", tag?: string, limit?: number, offset?: number }`

#### `get_post`
- **Scope:** read
- **Input:** `{ id: string }`

#### `create_post`
- **Scope:** write
- **Input:** `{ title: string, slug?: string, mdxBody?: string, metaTitle?: string, metaDescription?: string, authorId?: string, tagIds?: string[], ... }`

#### `update_post`
- **Scope:** write
- **Input:** `{ id: string, patch: Partial<PostInput> }`

#### `publish_post`
Runs all 11 guardrails. Returns `{ ok: false, code: "guardrail-failed", issues: [...] }` if errors exist — the LLM can read the issues, fix them, and retry.
- **Scope:** write
- **Input:** `{ id: string }`

#### `unpublish_post`
- **Scope:** write
- **Input:** `{ id: string }`

#### `schedule_post`
- **Scope:** write
- **Input:** `{ id: string, scheduledAt: string (ISO date) }`

#### `delete_post`
- **Scope:** admin
- **Input:** `{ id: string }`

---

### Page tools

Same as post tools but for static pages: `list_pages`, `get_page`, `create_page`, `update_page`, `publish_page`, `delete_page`.

---

### Media tools

#### `list_media`
- **Scope:** read
- **Input:** `{ limit?: number, offset?: number }`

#### `upload_media_from_url`
Downloads, processes (WebP/AVIF variants), and stores an image.
- **Scope:** write
- **Input:** `{ url: string, alt: string }`

#### `delete_media`
- **Scope:** write
- **Input:** `{ id: string }`

---

### Author tools

`list_authors`, `get_author`, `create_author`, `update_author` — standard CRUD for E-E-A-T author profiles.

---

### Taxonomy tools

`list_tags`, `create_tag`, `list_categories`, `create_category`.

---

### Audit tools

#### `run_audit`
Runs PageSpeed, link check, schema validation, and AI readiness check on a URL.
- **Scope:** write
- **Input:** `{ url: string, postId?: string, pageId?: string }`

#### `get_audit`
Get the most recent audit result for a URL.
- **Scope:** read
- **Input:** `{ url: string }`

#### `list_broken_pages`
List pages with non-green audit status.
- **Scope:** read
- **Input:** `{ severity?: "red"|"yellow" }`

#### `suggest_fixes`
Uses AI (via OpenRouter) to propose specific fixes for a page's audit issues.
- **Scope:** write
- **Input:** `{ url: string }`
- **Output:** `Array<{ issue: string, fix: string, priority: "high"|"medium"|"low" }>`

---

### Programmatic SEO tools

#### `create_programmatic_template`
- **Scope:** write
- **Input:** `{ name: string, templateMdx: string, datasetUrl?: string, fieldMapping?: Record<string, string> }`

#### `run_programmatic`
- **Scope:** write
- **Input:** `{ templateId: string, dryRun?: boolean }`

#### `list_programmatic_runs`
- **Scope:** read
- **Input:** `{ templateId: string }`

---

### Schema and duplicate tools

#### `generate_schema`
- **Scope:** read
- **Input:** `{ postId: string }`

#### `check_duplicate`
- **Scope:** read
- **Input:** `{ content: string }`
- **Output:** `{ similarity: number, isDuplicate: boolean, isNearDuplicate: boolean }`

---

### Redirect tools

`list_redirects`, `create_redirect`, `delete_redirect`.
