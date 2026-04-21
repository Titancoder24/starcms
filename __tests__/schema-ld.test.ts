import { describe, it, expect } from "vitest";
import { generateSchemaForPost, generateSchemaForPage, generateOrganization } from "@/lib/schema-ld";

const mockSite = {
  id: "site-1",
  ownerId: "user-1",
  name: "Test Site",
  slug: "test-site",
  domain: "testsite.com",
  defaultTheme: "prose",
  settings: {
    organization: {
      legalName: "Test Co",
      logoUrl: "https://testsite.com/logo.png",
      sameAs: ["https://twitter.com/test"],
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPost = {
  id: "post-1",
  siteId: "site-1",
  slug: "test-post",
  title: "Test Post",
  mdxBody: "## Section\n\nContent here.",
  excerpt: "A test post.",
  metaTitle: "Test Post — Test Site",
  metaDescription: "This is a test post for schema generation.",
  canonical: null,
  status: "published" as const,
  publishedAt: new Date("2026-01-01"),
  scheduledAt: null,
  authorId: null,
  coverMediaId: null,
  seo: {},
  embedding: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPage = {
  ...mockPost,
  id: "page-1",
  slug: "about",
  title: "About",
};

const mockAuthor = {
  id: "author-1",
  siteId: "site-1",
  name: "Jane Smith",
  slug: "jane-smith",
  bio: "Expert author.",
  credentials: "PhD",
  expertise: ["SEO"],
  image: null,
  socialLinks: { twitter: "https://twitter.com/jane" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("generateSchemaForPost", () => {
  it("generates valid schema with @context and @graph", () => {
    const schema = generateSchemaForPost(mockPost, mockSite, mockAuthor);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@graph"]).toBeDefined();
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    expect(graph.length).toBeGreaterThanOrEqual(2);
  });

  it("includes Article type in the graph", () => {
    const schema = generateSchemaForPost(mockPost, mockSite, mockAuthor);
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const article = graph.find((n) => n["@type"] === "Article");
    expect(article).toBeDefined();
    expect(article?.["headline"]).toBe("Test Post");
  });

  it("includes BreadcrumbList", () => {
    const schema = generateSchemaForPost(mockPost, mockSite);
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList");
    expect(crumbs).toBeDefined();
  });

  it("includes FAQPage when FAQ blocks are present", () => {
    const postWithFaq = {
      ...mockPost,
      mdxBody: `<FAQ><FAQItem question="What is SEO?">SEO means search engine optimization.</FAQItem></FAQ>`,
    };
    const schema = generateSchemaForPost(postWithFaq, mockSite);
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const faq = graph.find((n) => n["@type"] === "FAQPage");
    expect(faq).toBeDefined();
  });
});

describe("generateOrganization", () => {
  it("uses legalName from settings", () => {
    const org = generateOrganization(mockSite);
    expect(org["name"]).toBe("Test Co");
    expect(org["@type"]).toBe("Organization");
  });
});

describe("generateSchemaForPage", () => {
  it("generates WebPage type", () => {
    const schema = generateSchemaForPage(mockPage, mockSite);
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const webPage = graph.find((n) => n["@type"] === "WebPage");
    expect(webPage).toBeDefined();
  });
});
