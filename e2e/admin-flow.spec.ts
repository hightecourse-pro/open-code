import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

async function open(page: Page, url: string) {
  const resp = await page.goto(url);
  expect(resp?.status() ?? 200, `${url} returned an error status`).toBeLessThan(400);
}

test.describe("admin flow", () => {
  test("dashboard loads with admin navigation", async ({ page }) => {
    await open(page, "/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: /קונפיגורציה|חברות/ }).first()).toBeVisible();
  });

  test("members management loads with instant search + VIP filter", async ({ page }) => {
    await open(page, "/admin/members");
    await expect(page).toHaveURL(/members/);
    // Instant client-side search (no form submit / URL change).
    const search = page.getByPlaceholder(/חיפוש לפי שם/);
    await expect(search).toBeVisible();
    await search.fill("zzz-no-such-member");
    await expect(page.getByText("לא נמצאו חברות בסינון הזה.")).toBeVisible();
  });

  test("content management: create a course; link editor present", async ({ page }) => {
    await open(page, "/admin/content");
    await expect(page.getByRole("heading", { name: /ניהול תכנים/ })).toBeVisible();
    const title = `קורס E2E ${Date.now()}`;
    await page.locator('form input[name="title"]').first().fill(title);
    await page.getByRole("button", { name: /הוספת קורס/ }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    // The new course renders a Drive-link editor (video/materials tagging).
    await expect(page.locator('select[name="kind"]').first()).toBeVisible();
  });

  test("shares queue loads", async ({ page }) => {
    await open(page, "/admin/shares");
    await expect(page.getByRole("heading", { name: /תור שיתופים/ })).toBeVisible();
  });

  test("analytics loads", async ({ page }) => {
    await open(page, "/admin/analytics");
    await expect(page.getByRole("heading", { name: /אנליטיקת למידה/ })).toBeVisible();
  });

  test("config: membership pricing form loads", async ({ page }) => {
    await open(page, "/admin/config");
    await expect(page.locator('input[name="monthly"]')).toBeVisible();
  });

  test("jobs management: add a job end-to-end", async ({ page }) => {
    await open(page, "/admin/jobs");
    await expect(page.locator('input[name="company"]')).toBeVisible();
    // Internal ("ours") job — no external apply link required.
    await page.selectOption('select[name="source"]', "ours");
    await page.fill('input[name="company"]', "E2E TestCo");
    await page.fill('input[name="title"]', "Junior QA (E2E)");
    await page.getByRole("button", { name: /הוספת משרה/ }).click();
    await expect(page.getByText(/נוספה/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("sessions management form loads", async ({ page }) => {
    await open(page, "/admin/sessions");
    await expect(page.locator('input[name="title"]')).toBeVisible();
  });
});
