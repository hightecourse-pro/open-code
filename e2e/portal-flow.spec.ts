import { test, expect } from "@playwright/test";
import fs from "fs";

// The employer-portal client journey, end to end. Fixture data (client, listed
// candidate, job with the candidate curated onto it) is seeded by:
//   node --env-file=.env.local scripts/seed-portal-qa.mjs
const FIXTURE = "e2e/.auth/portal-qa.json";
const fx = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
  username: string;
  password: string;
  company: string;
  candidateName: string;
  jobTitle: string;
  jobId: string;
  profileId: string;
};

test.describe("portal — public login", () => {
  test("login page renders, company-voiced", async ({ page }) => {
    await page.goto("/portal/login");
    await expect(page.getByRole("heading", { name: "התחברו לפורטל" })).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("wrong password shows one friendly, non-revealing error", async ({ page }) => {
    await page.goto("/portal/login");
    await page.fill('input[name="username"]', fx.username);
    await page.fill('input[name="password"]', "definitely-wrong");
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page.getByText("שם המשתמש או הסיסמה שגויים.")).toBeVisible();
  });

  test("portal pages redirect to login without a session", async ({ page }) => {
    for (const path of ["/portal", "/portal/jobs", "/portal/favorites"]) {
      await page.goto(path);
      await expect(page, `${path} must not render without a session`).toHaveURL(/\/portal\/login/);
    }
  });
});

test.describe("portal — client journey", () => {
  test("login → search → profile → favorite → my jobs → 404 isolation → logout", async ({
    page,
  }) => {
    // -------------------------------------------------------------- login
    await page.goto("/portal/login");
    await page.fill('input[name="username"]', fx.username);
    await page.fill('input[name="password"]', fx.password);
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page).toHaveURL(/\/portal$/, { timeout: 15_000 });

    // ------------------------------------------------------------- search
    await expect(page.getByRole("heading", { name: "חיפוש מועמדות" })).toBeVisible();
    // The parameter palette must exist (built from employer-visible questions).
    await expect(page.locator("#portal-param")).toBeVisible();
    const paramCount = await page.locator("#portal-param option").count();
    expect(paramCount, "search parameters must not be empty").toBeGreaterThan(0);
    // The seeded candidate appears in the grid.
    await expect(page.getByText(fx.candidateName).first()).toBeVisible();

    // -------------------------------------------------- candidate profile
    await page.getByText(fx.candidateName).first().click();
    await expect(page).toHaveURL(/\/portal\/candidate\//);
    await expect(page.getByRole("heading", { name: fx.candidateName })).toBeVisible();
    // Internal-only data must never surface to a client.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body, "VIP must never appear in the portal").not.toContain("vip");

    // ------------------------------------------------------------ favorite
    const addStar = page.getByRole("button", { name: "הוספה למועדפות" });
    const removeStar = page.getByRole("button", { name: "הסרה מהמועדפות" });
    // A previous (failed) run may have left the candidate favorited — reset first.
    if (await removeStar.count()) {
      await removeStar.first().click();
      await expect(addStar.first()).toBeVisible();
    }
    await expect(addStar.first()).toBeVisible();
    await addStar.first().click();
    await expect(removeStar.first()).toBeVisible();

    await page.goto("/portal/favorites");
    await expect(page.getByRole("heading", { name: "המועדפות שלי" })).toBeVisible();
    // The star flips optimistically before the server write lands — poll with
    // reloads instead of asserting on the first paint.
    await expect
      .poll(
        async () => {
          const visible = await page
            .getByText(fx.candidateName)
            .first()
            .isVisible()
            .catch(() => false);
          if (!visible) await page.reload();
          return visible;
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    // Un-favorite from the card, then the empty state teaches the feature.
    const unstar = page.getByRole("button", { name: "הסרה מהמועדפות" }).first();
    await unstar.click();
    // The optimistic star flips immediately; wait for it so the server action
    // has been dispatched before we reload and assert the persisted state.
    await expect(page.getByRole("button", { name: "הוספה למועדפות" }).first()).toBeVisible();
    await expect
      .poll(
        async () => {
          await page.reload();
          return page.getByText("עדיין לא סימנתם מועדפות").isVisible();
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    // ------------------------------------------------------------- my jobs
    await page.goto("/portal/jobs");
    await expect(page.getByRole("heading", { name: "המשרות שלי" })).toBeVisible();
    await expect(page.getByText(fx.jobTitle).first()).toBeVisible();
    await expect(page.getByText(fx.candidateName).first()).toBeVisible();

    // The focused job page a client reaches from the email.
    await page.goto(`/portal/job/${fx.jobId}`);
    await expect(page.getByRole("heading", { name: fx.jobTitle })).toBeVisible();
    await expect(page.getByText(fx.candidateName).first()).toBeVisible();

    // --------------------------------------- ownership isolation (404, not leak)
    const foreign = await page.goto("/portal/job/00000000-0000-0000-0000-000000000000");
    expect(foreign?.status(), "a job that is not this client's must 404").toBe(404);

    // -------------------------------------------------------------- logout
    await page.goto("/portal");
    await page.getByRole("button", { name: "התנתקות" }).click();
    await expect(page).toHaveURL(/\/portal\/login/);
    await page.goto("/portal/jobs");
    await expect(page).toHaveURL(/\/portal\/login/);
  });
});
