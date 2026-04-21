import { describe, it, expect } from "vitest";
import { fleschReadingEase, countWords, wordCount } from "@/lib/util/readability";

describe("fleschReadingEase", () => {
  it("gives high score for simple text", () => {
    const simple = "The cat sat on the mat. The dog ran fast. It was a good day.";
    const score = fleschReadingEase(simple);
    expect(score).toBeGreaterThan(60);
  });

  it("gives low score for complex text", () => {
    const complex = "The epistemological ramifications of phenomenological ontological discourse necessitate comprehensive scrutinization.";
    const score = fleschReadingEase(complex);
    expect(score).toBeLessThan(30);
  });

  it("returns 0 for empty string", () => {
    expect(fleschReadingEase("")).toBe(0);
  });
});

describe("countWords", () => {
  it("counts words correctly", () => {
    expect(countWords("hello world foo")).toBe(3);
    expect(countWords("  spaces  between  ")).toBe(2);
    expect(countWords("")).toBe(0);
  });
});

describe("wordCount for MDX", () => {
  it("strips markdown syntax before counting", () => {
    const mdx = "## Heading\n\n**Bold text** and *italic* with [link](http://example.com).";
    const count = wordCount(mdx);
    expect(count).toBeGreaterThan(3);
  });
});
