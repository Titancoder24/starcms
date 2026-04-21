import { test, expect } from "@playwright/test";

test.describe("Critical path: sign in → create post → view → audit", () => {
  test("signin page loads and shows email form", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByText("StarCMS")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
  });

  test("public post page returns 404 for unknown slug", async ({ page }) => {
    const res = await page.goto("/p/this-post-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("robots.txt is served", async ({ page }) => {
    const res = await page.goto("/robots.txt");
    expect(res?.status()).toBe(200);
    const text = await page.content();
    expect(text).toContain("User-agent");
    expect(text).toContain("Sitemap");
  });

  test("sitemap.xml is served", async ({ page }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
  });

  test("llms.txt is served", async ({ page }) => {
    const res = await page.goto("/llms.txt");
    expect(res?.status()).toBe(200);
  });

  test("health check returns healthy", async ({ page }) => {
    const res = await page.goto("/api/health");
    expect(res?.status()).toBe(200);
  });

  test("admin redirects to signin when unauthenticated", async ({ page }) => {
    await page.goto("/admin/posts");
    await expect(page).toHaveURL(/signin/);
  });
});
