import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["owner", "editor", "viewer"]);
export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "scheduled",
  "published",
  "archived",
]);
export const auditSourceEnum = pgEnum("audit_source", [
  "cron",
  "manual",
  "publish",
]);
export const auditStatusEnum = pgEnum("audit_status", [
  "green",
  "yellow",
  "red",
]);
export const apiKeyScopeEnum = pgEnum("api_key_scope", [
  "read",
  "write",
  "admin",
]);
// Redirect status codes stored as strings in enum, cast to integer in application layer
export const redirectStatusEnum = pgEnum("redirect_status", ["301", "302", "308"]);
export const programmaticTemplateStatusEnum = pgEnum(
  "programmatic_template_status",
  ["draft", "active", "paused"]
);
export const programmaticTemplateTypeEnum = pgEnum("programmatic_template_type", [
  "seo",         // generic keyword-based
  "geo",         // [keyword] in [city]
  "comparison",  // A vs B
  "review",      // product/service review
  "marketplace", // listing / lead-gen
  "aio",         // AI Overview optimised
  "llm",         // LLM search optimised
]);
export const aiProviderEnum = pgEnum("ai_provider", ["openrouter"]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  role: userRoleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Auth.js v5 required tables
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ─── Sites ────────────────────────────────────────────────────────────────────

export const sites = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  defaultTheme: text("default_theme").notNull().default("prose"),
  settings: jsonb("settings")
    .$type<{
      verificationTokens?: {
        google?: string;
        bing?: string;
        yandex?: string;
        naver?: string;
        baidu?: string;
        pinterest?: string;
        yahoo?: string;
      };
      organization?: {
        legalName?: string;
        logoUrl?: string;
        sameAs?: string[];
      };
      defaultAuthorId?: string;
      timezone?: string;
      minWordCounts?: {
        post?: number;
        page?: number;
      };
      readabilityThreshold?: number;
      pagespeeedApiKey?: string;
      robotsConfig?: {
        disallowGptBot?: boolean;
        disallowClaudeBot?: boolean;
        disallowGoogleExtended?: boolean;
        disallowPerplexityBot?: boolean;
        disallowCCBot?: boolean;
        disallowBytespider?: boolean;
      };
    }>()
    .default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Authors ──────────────────────────────────────────────────────────────────

export const authors = pgTable("authors", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  bio: text("bio"),
  credentials: text("credentials"),
  expertise: text("expertise").array(),
  image: text("image"),
  socialLinks: jsonb("social_links")
    .$type<{
      twitter?: string;
      linkedin?: string;
      github?: string;
      mastodon?: string;
      website?: string;
    }>()
    .default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Media ────────────────────────────────────────────────────────────────────

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  blobKey: text("blob_key").notNull(),
  alt: text("alt").notNull().default(""),
  width: integer("width"),
  height: integer("height"),
  format: text("format"),
  sizeBytes: integer("size_bytes"),
  blurhash: text("blurhash"),
  variants: jsonb("variants")
    .$type<
      Array<{
        width: number;
        height: number;
        url: string;
        format: string;
      }>
    >()
    .default([]),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Posts ────────────────────────────────────────────────────────────────────

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    mdxBody: text("mdx_body").notNull().default(""),
    excerpt: text("excerpt"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    canonical: text("canonical"),
    status: postStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    authorId: uuid("author_id").references(() => authors.id, {
      onDelete: "set null",
    }),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    seo: jsonb("seo")
      .$type<{
        openGraphImage?: string;
        twitterCardType?: "summary" | "summary_large_image";
        noIndex?: boolean;
        noFollow?: boolean;
        structuredDataTypeOverride?: string;
      }>()
      .default({}),
    embedding: jsonb("embedding").$type<number[]>().default([]),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("posts_site_slug_idx").on(table.siteId, table.slug)]
);

// ─── Pages ────────────────────────────────────────────────────────────────────

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    mdxBody: text("mdx_body").notNull().default(""),
    excerpt: text("excerpt"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    canonical: text("canonical"),
    status: postStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    authorId: uuid("author_id").references(() => authors.id, {
      onDelete: "set null",
    }),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    seo: jsonb("seo")
      .$type<{
        openGraphImage?: string;
        twitterCardType?: "summary" | "summary_large_image";
        noIndex?: boolean;
        noFollow?: boolean;
      }>()
      .default({}),
    embedding: jsonb("embedding").$type<number[]>().default([]),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("pages_site_slug_idx").on(table.siteId, table.slug)]
);

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => [uniqueIndex("tags_site_slug_idx").on(table.siteId, table.slug)]
);

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
  },
  (table) => [
    uniqueIndex("categories_site_slug_idx").on(table.siteId, table.slug),
  ]
);

// ─── Post↔Tag and Post↔Category join tables ───────────────────────────────────

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.tagId] })]
);

export const postCategories = pgTable(
  "post_categories",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.categoryId] })]
);

// ─── Programmatic SEO ─────────────────────────────────────────────────────────

export const programmaticTemplates = pgTable("programmatic_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateMdx: text("template_mdx").notNull().default(""),
  datasetUrl: text("dataset_url"),
  datasetCached: jsonb("dataset_cached").$type<unknown[]>().default([]),
  fieldMapping: jsonb("field_mapping")
    .$type<{
      slug?: string;
      title?: string;
      metaTitle?: string;
      metaDescription?: string;
      excerpt?: string;
      [key: string]: string | undefined;
    }>()
    .default({}),
  type: programmaticTemplateTypeEnum("type").notNull().default("seo"),
  status: programmaticTemplateStatusEnum("status").notNull().default("draft"),
  lastGeneratedAt: timestamp("last_generated_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const programmaticRuns = pgTable("programmatic_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => programmaticTemplates.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { mode: "date" }),
  totalRows: integer("total_rows").notNull().default(0),
  generatedCount: integer("generated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  reportJson: jsonb("report_json")
    .$type<
      Array<{
        row: number;
        slug: string;
        status: "generated" | "skipped" | "failed";
        issues?: Array<{ code: string; message: string }>;
      }>
    >()
    .default([]),
  dryRun: boolean("dry_run").notNull().default(false),
});

// ─── Geo / Entities / CTAs ────────────────────────────────────────────────────

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  country: text("country").notNull().default("US"),
  region: text("region"),
  city: text("city").notNull(),
  slug: text("slug").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  population: integer("population"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const entities = pgTable("entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull().default("product"), // product | service | tool | brand | place
  description: text("description"),
  url: text("url"),
  logoUrl: text("logo_url"),
  ratingValue: real("rating_value"),
  ratingCount: integer("rating_count"),
  priceRange: text("price_range"),
  pros: jsonb("pros").$type<string[]>().default([]),
  cons: jsonb("cons").$type<string[]>().default([]),
  attributes: jsonb("attributes").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const ctas = pgTable("ctas", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull().default("button"), // button | form | phone | email
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
  isAffiliate: boolean("is_affiliate").notNull().default(false),
  affiliateDisclosure: text("affiliate_disclosure"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Audit Runs ───────────────────────────────────────────────────────────────

export const auditRuns = pgTable(
  "audit_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    runAt: timestamp("run_at", { mode: "date" }).notNull().defaultNow(),
    source: auditSourceEnum("source").notNull().default("manual"),
    performanceScore: integer("performance_score"),
    seoScore: integer("seo_score"),
    accessibilityScore: integer("accessibility_score"),
    bestPracticesScore: integer("best_practices_score"),
    lcpMs: integer("lcp_ms"),
    inpMs: integer("inp_ms"),
    cls: text("cls"),
    ttfbMs: integer("ttfb_ms"),
    schemaValid: boolean("schema_valid"),
    schemaErrors: jsonb("schema_errors").$type<string[]>().default([]),
    brokenLinks: jsonb("broken_links")
      .$type<Array<{ href: string; status: number }>>()
      .default([]),
    brokenImages: jsonb("broken_images")
      .$type<Array<{ src: string; status: number }>>()
      .default([]),
    aiReadinessScore: integer("ai_readiness_score"),
    issues: jsonb("issues")
      .$type<
        Array<{
          code: string;
          severity: "error" | "warn" | "info";
          message: string;
          fix: string;
        }>
      >()
      .default([]),
    status: auditStatusEnum("status").notNull().default("yellow"),
  },
  (table) => [index("audit_runs_url_run_at_idx").on(table.url, table.runAt)]
);

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scope: apiKeyScopeEnum("scope").notNull().default("read"),
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── MCP Call Log ─────────────────────────────────────────────────────────────

export const mcpCallLog = pgTable("mcp_call_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, {
    onDelete: "set null",
  }),
  tool: text("tool").notNull(),
  inputSummary: text("input_summary"),
  outcome: text("outcome").notNull().default("ok"),
  durationMs: integer("duration_ms"),
  calledAt: timestamp("called_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── AI Keys ──────────────────────────────────────────────────────────────────

export const aiKeys = pgTable("ai_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  provider: aiProviderEnum("provider").notNull().default("openrouter"),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
});

// ─── Redirects ────────────────────────────────────────────────────────────────

export const redirects = pgTable("redirects", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  fromPath: text("from_path").notNull(),
  toPath: text("to_path").notNull(),
  statusCode: integer("status_code").notNull().default(301),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sites: many(sites),
  apiKeys: many(apiKeys),
  aiKeys: many(aiKeys),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  owner: one(users, { fields: [sites.ownerId], references: [users.id] }),
  authors: many(authors),
  posts: many(posts),
  pages: many(pages),
  tags: many(tags),
  categories: many(categories),
  media: many(media),
  auditRuns: many(auditRuns),
  apiKeys: many(apiKeys),
  aiKeys: many(aiKeys),
  redirects: many(redirects),
  programmaticTemplates: many(programmaticTemplates),
}));

export const authorsRelations = relations(authors, ({ one, many }) => ({
  site: one(sites, { fields: [authors.siteId], references: [sites.id] }),
  posts: many(posts),
  pages: many(pages),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  site: one(sites, { fields: [posts.siteId], references: [sites.id] }),
  author: one(authors, { fields: [posts.authorId], references: [authors.id] }),
  coverMedia: one(media, {
    fields: [posts.coverMediaId],
    references: [media.id],
  }),
  postTags: many(postTags),
  postCategories: many(postCategories),
  auditRuns: many(auditRuns),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  author: one(authors, { fields: [pages.authorId], references: [authors.id] }),
  coverMedia: one(media, {
    fields: [pages.coverMediaId],
    references: [media.id],
  }),
  auditRuns: many(auditRuns),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const postCategoriesRelations = relations(postCategories, ({ one }) => ({
  post: one(posts, { fields: [postCategories.postId], references: [posts.id] }),
  category: one(categories, {
    fields: [postCategories.categoryId],
    references: [categories.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  site: one(sites, { fields: [tags.siteId], references: [sites.id] }),
  postTags: many(postTags),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  site: one(sites, { fields: [categories.siteId], references: [sites.id] }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  site: one(sites, { fields: [media.siteId], references: [sites.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  site: one(sites, { fields: [apiKeys.siteId], references: [sites.id] }),
  callLogs: many(mcpCallLog),
}));

export const aiKeysRelations = relations(aiKeys, ({ one }) => ({
  user: one(users, { fields: [aiKeys.userId], references: [users.id] }),
  site: one(sites, { fields: [aiKeys.siteId], references: [sites.id] }),
}));

export const programmaticTemplatesRelations = relations(
  programmaticTemplates,
  ({ one, many }) => ({
    site: one(sites, {
      fields: [programmaticTemplates.siteId],
      references: [sites.id],
    }),
    runs: many(programmaticRuns),
  })
);

export const programmaticRunsRelations = relations(
  programmaticRuns,
  ({ one }) => ({
    template: one(programmaticTemplates, {
      fields: [programmaticRuns.templateId],
      references: [programmaticTemplates.id],
    }),
  })
);

export const auditRunsRelations = relations(auditRuns, ({ one }) => ({
  site: one(sites, { fields: [auditRuns.siteId], references: [sites.id] }),
  post: one(posts, { fields: [auditRuns.postId], references: [posts.id] }),
  page: one(pages, { fields: [auditRuns.pageId], references: [pages.id] }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  site: one(sites, { fields: [locations.siteId], references: [sites.id] }),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  site: one(sites, { fields: [entities.siteId], references: [sites.id] }),
  ctas: many(ctas),
}));

export const ctasRelations = relations(ctas, ({ one }) => ({
  site: one(sites, { fields: [ctas.siteId], references: [sites.id] }),
  entity: one(entities, { fields: [ctas.entityId], references: [entities.id] }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuditRun = typeof auditRuns.$inferSelect;
export type NewAuditRun = typeof auditRuns.$inferInsert;
export type AiKey = typeof aiKeys.$inferSelect;
export type NewAiKey = typeof aiKeys.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
export type ProgrammaticTemplate = typeof programmaticTemplates.$inferSelect;
export type NewProgrammaticTemplate = typeof programmaticTemplates.$inferInsert;
export type ProgrammaticRun = typeof programmaticRuns.$inferSelect;
export type NewProgrammaticRun = typeof programmaticRuns.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type Cta = typeof ctas.$inferSelect;
export type NewCta = typeof ctas.$inferInsert;
