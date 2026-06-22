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

  test("members management loads", async ({ page }) => {
    await open(page, "/admin/members");
    await expect(page).toHaveURL(/members/);
  });

  test("config: membership pricing form loads", async ({ page }) => {
    await open(page, "/admin/config");
    await expect(page.locator('input[name="monthly"]')).toBeVisible();
  });

  test("jobs management: add a job end-to-end", async ({ page }) => {
    await open(page, "/admin/jobs");
    await expect(page.locator('input[name="company"]')).toBeVisible();
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
