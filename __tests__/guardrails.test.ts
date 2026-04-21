import { describe, it, expect } from "vitest";
import { checkMetaTitle } from "@/lib/guardrails/meta-title";
import { checkMetaDescription } from "@/lib/guardrails/meta-description";
import { checkSingleH1 } from "@/lib/guardrails/single-h1";
import { checkHeadingHierarchy } from "@/lib/guardrails/heading-hierarchy";
import { checkAltText } from "@/lib/guardrails/alt-text";
import { checkCanonical } from "@/lib/guardrails/canonical";
import { checkMinWords } from "@/lib/guardrails/min-words";
import { checkInternalLinks } from "@/lib/guardrails/internal-links";
import { checkReadability } from "@/lib/guardrails/readability";
import type { PostForCheck } from "@/lib/guardrails/types";

function makeInput(overrides: Partial<PostForCheck["post"]> = {}): PostForCheck {
  return {
    post: {
      id: "test-id",
      siteId: "site-id",
      slug: "test-post",
      title: "Test Post Title That Is Reasonable",
      mdxBody: "## Introduction\n\nThis is a test post with [link one](/p/other-post) and [link two](/p/another-post) for testing purposes. It has enough words to pass the minimum word count requirement when we include enough content here.\n\nSome more content to pad the word count and ensure readability checks pass when the text is simple enough for a Flesch score above 50.\n\nAnd even more content here to ensure we have at least 300 words in total. The post discusses various topics and includes multiple paragraphs of substantive content that would be useful to readers who want to understand the subject matter.",
      metaTitle: "Test Post Title That Works SEO",
      metaDescription: "This is a meta description that is exactly the right length, somewhere between 120 and 160 characters to pass the check.",
      canonical: null,
      status: "draft" as const,
      publishedAt: null,
      scheduledAt: null,
      authorId: null,
      coverMediaId: null,
      seo: {},
      embedding: [],
      excerpt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    },
    site: null,
    author: null,
    allPublishedPosts: [],
    publishedPosts: [
      { id: "other-post", slug: "other-post", mdxBody: "" },
      { id: "another-post", slug: "another-post", mdxBody: "" },
    ],
  };
}

describe("meta-title guardrail", () => {
  it("passes when title is 30-60 chars", () => {
    const result = checkMetaTitle(makeInput({ metaTitle: "A Good Meta Title Exactly Right" }));
    expect(result.pass).toBe(true);
  });

  it("fails when title is too short", () => {
    const result = checkMetaTitle(makeInput({ metaTitle: "Too short" }));
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("fails when title is too long", () => {
    const result = checkMetaTitle(makeInput({ metaTitle: "A Very Long Meta Title That Exceeds Sixty Characters And Should Fail" }));
    expect(result.pass).toBe(false);
  });
});

describe("meta-description guardrail", () => {
  it("passes with 120-160 chars", () => {
    const desc = "A".repeat(130);
    const result = checkMetaDescription(makeInput({ metaDescription: desc }));
    expect(result.pass).toBe(true);
  });

  it("fails when empty", () => {
    const result = checkMetaDescription(makeInput({ metaDescription: "" }));
    expect(result.pass).toBe(false);
  });

  it("fails when too long", () => {
    const result = checkMetaDescription(makeInput({ metaDescription: "A".repeat(200) }));
    expect(result.pass).toBe(false);
  });
});

describe("single-h1 guardrail", () => {
  it("passes with zero H1s", () => {
    const result = checkSingleH1(makeInput({ mdxBody: "## Section\n\nContent here." }));
    expect(result.pass).toBe(true);
  });

  it("passes with one H1", () => {
    const result = checkSingleH1(makeInput({ mdxBody: "# Title\n\n## Section\n\nContent." }));
    expect(result.pass).toBe(true);
  });

  it("fails with two H1s", () => {
    const result = checkSingleH1(makeInput({ mdxBody: "# Title One\n\n# Title Two\n\nContent." }));
    expect(result.pass).toBe(false);
  });
});

describe("heading-hierarchy guardrail", () => {
  it("passes with valid hierarchy", () => {
    const result = checkHeadingHierarchy(makeInput({
      mdxBody: "## Section\n\n### Subsection\n\nContent.",
    }));
    expect(result.pass).toBe(true);
  });

  it("fails when heading levels skip", () => {
    const result = checkHeadingHierarchy(makeInput({
      mdxBody: "## Section\n\n#### Skipped\n\nContent.",
    }));
    expect(result.pass).toBe(false);
  });
});

describe("alt-text guardrail", () => {
  it("passes when all images have alt text", () => {
    const result = checkAltText(makeInput({
      mdxBody: "![A beautiful sunset](https://example.com/img.jpg)\n\nContent.",
    }));
    expect(result.pass).toBe(true);
  });

  it("fails when image has empty alt", () => {
    const result = checkAltText(makeInput({
      mdxBody: "![](https://example.com/img.jpg)\n\nContent.",
    }));
    expect(result.pass).toBe(false);
  });

  it("fails when alt text looks like a filename", () => {
    const result = checkAltText(makeInput({
      mdxBody: "![image.jpg](https://example.com/img.jpg)\n\nContent.",
    }));
    expect(result.pass).toBe(false);
  });
});

describe("canonical guardrail", () => {
  it("passes with no canonical (self-URL)", () => {
    const result = checkCanonical(makeInput({ canonical: null }));
    expect(result.pass).toBe(true);
  });

  it("passes with valid https canonical", () => {
    const result = checkCanonical(makeInput({ canonical: "https://example.com/post" }));
    expect(result.pass).toBe(true);
  });

  it("fails with invalid canonical", () => {
    const result = checkCanonical(makeInput({ canonical: "not-a-url" }));
    expect(result.pass).toBe(false);
  });
});

describe("min-words guardrail", () => {
  it("passes when body has enough words", () => {
    const longBody = ("Word ".repeat(320)).trim();
    const result = checkMinWords(makeInput({ mdxBody: longBody }));
    expect(result.pass).toBe(true);
  });

  it("fails when body is too short", () => {
    const result = checkMinWords(makeInput({ mdxBody: "Too short." }));
    expect(result.pass).toBe(false);
  });
});

describe("internal-links guardrail", () => {
  it("passes when body has 2+ internal links to published posts", () => {
    const input = makeInput();
    const result = checkInternalLinks(input);
    expect(result.pass).toBe(true);
  });

  it("fails when fewer than 2 internal links", () => {
    const input = makeInput({ mdxBody: "Only [one link](/p/other-post) in the content." });
    const result = checkInternalLinks(input);
    expect(result.pass).toBe(false);
  });
});

describe("readability guardrail", () => {
  it("passes with simple readable text", () => {
    const simpleText = "The cat sat on the mat. It was a good day. The sun was bright and warm. Dogs played in the park nearby. Children laughed and ran around in the cool air. Everyone had a great time outside today.";
    const result = checkReadability(makeInput({ mdxBody: simpleText }));
    expect(result.pass).toBe(true);
  });
});
