import { test, expect } from "@playwright/test";

// Test admin account (seeded). Override via env if needed.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@opencode.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "opencode1234";

test.describe("public pages + gating", () => {
  test("home is a public landing page that renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/הקריירה שלך/)).toBeVisible();
  });

  test("landing CTA links to signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "הצטרפות לקהילה" }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "כניסה" })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("protected route redirects to login when logged out", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);
  });

  test('"forgot password" shows a confirmation message', async ({ page }) => {
    await page.goto("/forgot-password");
    await page.fill('input[name="email"]', "e2e-nobody@example.com");
    await page.getByRole("button", { name: /איפוס/ }).click();
    await expect(page.getByText(/קישור לאיפוס|שלחנו/)).toBeVisible();
  });
});

test.describe("admin auth", () => {
  test("admin logs in, lands on feed, and can reach the admin area", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.getByRole("button", { name: "כניסה" }).click();

    await expect(page).toHaveURL(/\/feed/, { timeout: 15_000 });
    // The admin-only sidebar entry is visible to admins.
    await expect(page.getByRole("link", { name: /ניהול הקהילה/ })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
  });
});
