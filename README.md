# StarCMS

**The CMS built to rank.**

StarCMS is a free, open-source, self-hostable CMS whose only job is to make your content rank — on Google, Bing, and inside every generative engine (ChatGPT, Claude, Gemini, Perplexity). It enforces SEO correctness at publish time through hard guardrails, audits every published URL continuously, and exposes the entire CMS as an MCP server so your LLM agent can drive it.

## Why StarCMS is different

| Feature | StarCMS | Ghost | WordPress + Yoast | Payload |
|---------|---------|-------|-------------------|---------|
| Pre-publish guardrails (hard blocks) | ✓ | ✗ | Advisory only | ✗ |
| Continuous per-URL audit dashboard | ✓ | ✗ | ✗ | ✗ |
| MCP-native (agent-driveable) | ✓ | ✗ | ✗ | ✗ |
| llms.txt + AI readiness scoring | ✓ | ✗ | ✗ | ✗ |
| Programmatic SEO with per-row guardrails | ✓ | ✗ | ✗ | ✗ |
| Self-hostable, zero vendor lock-in | ✓ | ✓ | ✓ | ✓ |

---

## Quickstart (self-host)

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL database (Supabase, Neon, local, etc.)

### 1. Clone and install

```bash
git clone https://github.com/titancoder24/starcms.git
cd starcms
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL, AUTH_SECRET, etc.
```

### 3. Push database schema

```bash
pnpm db:push
```

### 4. Seed demo data (optional)

```bash
pnpm db:seed
```

### 5. Start development server

```bash
pnpm dev

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
