import { test as setup, expect } from "@playwright/test";
import fs from "fs";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@opencode.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "opencode1234";
const ADMIN_STATE = "e2e/.auth/admin.json";

// Logs in as the admin (active member) once; flow specs reuse the session.
setup("authenticate as admin", async ({ page }) => {
  fs.mkdirSync("e2e/.auth", { recursive: true });
  await page.goto("/login");
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await expect(page).toHaveURL(/\/feed/, { timeout: 15_000 });
  await page.context().storageState({ path: ADMIN_STATE });
});
