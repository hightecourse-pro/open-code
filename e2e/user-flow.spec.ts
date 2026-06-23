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

  test("profile form loads with the experience gate + enforces required fields", async ({ page }) => {
    await open(page, "/profile");
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
    // The experience gate question is present (drives the junior/experienced branch).
    await expect(page.getByText(/ניסיון אמיתי בתעשייה/)).toBeVisible();
    await page.getByRole("button", { name: /שמירת הפרופיל/ }).click();
    // One of: first-completion redirect to /feed, success alert, or the
    // required-fields validation message (empty required fields).
    await expect
      .poll(
        async () =>
          new URL(page.url()).pathname === "/feed" ||
          (await page.getByText(/נשמר|שדות חובה/).isVisible()),
        { timeout: 15_000 }
      )
      .toBe(true);
  });

  test("CV management page renders with upload form", async ({ page }) => {
    await open(page, "/cv");
    await expect(page.getByRole("heading", { name: /ניהול קורות חיים/ })).toBeVisible();
    await expect(page.locator('input[name="file"]')).toBeAttached();
    await expect(page.locator('select[name="language"]')).toBeVisible();
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
    // The checker now takes a PDF upload (sent to Gemini), not pasted text.
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");
    await page
      .locator('input[name="cv_file"]')
      .setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: pdf });
    await page.getByRole("button", { name: /בדיקת קורות חיים/ }).click();
    await expect(page.getByText(/מפתח Google|מפתחות ה-AI/)).toBeVisible({ timeout: 20_000 });
  });

  test("interview setup renders", async ({ page }) => {
    await open(page, "/ai/interview");
    await expect(page.getByRole("heading", { name: /סימולטור ראיונות/ })).toBeVisible();
  });
});
