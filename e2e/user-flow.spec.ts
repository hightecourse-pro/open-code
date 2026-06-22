import { test, expect, type Page } from "@playwright/test";

// Active community member (the admin account is active, so it exercises the
// same member-facing pages a regular active member sees).
test.use({ storageState: "e2e/.auth/admin.json" });

async function open(page: Page, url: string) {
  const resp = await page.goto(url);
  expect(resp?.status() ?? 200, `${url} returned an error status`).toBeLessThan(400);
}

test.describe("user flow — community features", () => {
  test("feed: publish a post and see it appear", async ({ page }) => {
    await open(page, "/feed");
    const body = page.getByPlaceholder("מה את רוצה לשתף עם הקהילה?");
    await expect(body).toBeVisible();
    const text = `בדיקת E2E ${Date.now()}`;
    await body.fill(text);
    await page.getByRole("button", { name: "שיתוף", exact: true }).click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 15_000 });
  });

  test("jobs: board renders with seeded jobs", async ({ page }) => {
    await open(page, "/jobs");
    await expect(page.getByRole("heading", { name: /משרות שמתאימות/ })).toBeVisible();
    await expect(page.getByText("Wix").first()).toBeVisible();
  });

  test("courses: library renders", async ({ page }) => {
    await open(page, "/courses");
    await expect(page.getByRole("heading", { name: /ספריית הקורסים/ })).toBeVisible();
  });

  test("recordings render", async ({ page }) => {
    await open(page, "/recordings");
    await expect(page.getByRole("heading", { name: /הקלטות סשנים/ })).toBeVisible();
  });

  test("events render", async ({ page }) => {
    await open(page, "/events");
    await expect(page.getByRole("heading", { name: /אירועים וסשנים/ })).toBeVisible();
  });

  test("forum renders", async ({ page }) => {
    await open(page, "/forum");
    await expect(page.getByRole("heading", { name: /הפורום/ })).toBeVisible();
  });

  test("profile form loads and saves", async ({ page }) => {
    await open(page, "/profile");
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
    await page.getByRole("button", { name: /שמירת הפרופיל/ }).click();
    await expect(page.getByText(/נשמר/)).toBeVisible({ timeout: 15_000 });
  });

  test("mentor directory renders", async ({ page }) => {
    await open(page, "/mentor");
    await expect(page.getByRole("heading", { name: /המנטוריות/ })).toBeVisible();
  });

  test("chat renders", async ({ page }) => {
    await open(page, "/chat");
    await expect(page.getByRole("heading", { name: /אטים/ })).toBeVisible();
  });

  test("AI keys page renders with instructions", async ({ page }) => {
    await open(page, "/ai/keys");
    await expect(page.getByRole("heading", { name: /מפתחות ה-AI שלי/ })).toBeVisible();
  });

  test("CV checker prompts to add a key when none is configured", async ({ page }) => {
    await open(page, "/ai/cv-checker");
    await page
      .locator('textarea[name="cv"]')
      .fill("ניסיון בפיתוח React ו-Node.js, עבודת צוות אג'ילית, ".repeat(6));
    await page.getByRole("button", { name: /בדיקת קורות חיים/ }).click();
    await expect(page.getByText(/מפתח Google|מפתחות ה-AI/)).toBeVisible({ timeout: 20_000 });
  });

  test("interview setup renders", async ({ page }) => {
    await open(page, "/ai/interview");
    await expect(page.getByRole("heading", { name: /סימולטור ראיונות/ })).toBeVisible();
  });
});
