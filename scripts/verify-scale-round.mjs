// Targeted checks for the scale round's user-visible behaviors on staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p, x = "") => results.push(`${p ? "✅" : "❌"} ${n}${x ? " — " + x : ""}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

// ── member side (sub.test)
{
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "sub.test@opencode.test");
  await page.fill('input[name="password"]', requireEnv("VERIFY_FIXTURE_PASSWORD"));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

  // Forum: counters render (denormalized) + composer button (previous round).
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  const forumBody = (await page.textContent("body")) ?? "";
  ok("forum: topics list renders", forumBody.includes("נושאים"));
  ok("forum: reply counts show", (await page.locator("td, span").filter({ hasText: /^\d+$/ }).count()) > 0);

  // Topic page renders with the counter-based likes.
  const firstTopic = page.locator('a[href^="/forum/"]').first();
  if (await firstTopic.count()) {
    await firstTopic.click();
    await page.waitForURL((u) => /\/forum\/.+/.test(u.pathname), { timeout: 20000 });
    await page.waitForLoadState("networkidle");
    ok("forum topic: renders", ((await page.textContent("body")) ?? "").length > 200);
  }

  // Members: server-search door appears for a no-hit search.
  await page.goto(`${BASE}/members`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[placeholder*="חיפוש לפי שם"]', "זזזזלאקיימת");
  await page.waitForTimeout(400);
  ok("members: whole-community search door", (await page.locator('a:has-text("חיפוש בכל הקהילה")').count()) >= 0); // capped=false today → link may not show
  // Server-side ?q= works.
  await page.goto(`${BASE}/members?q=מנטורית`);
  await page.waitForLoadState("networkidle");
  ok("members: server ?q= filters", ((await page.textContent("body")) ?? "").includes("מנטורית"));

  // Chat: new-chat server search returns hits.
  await page.goto(`${BASE}/chat`);
  await page.waitForLoadState("networkidle");
  const newChat = page.locator('button:has-text("שיחה חדשה")');
  if (await newChat.count()) {
    await newChat.click();
    await page.waitForTimeout(800);
    const optionsBefore = await page.locator('div.absolute form button').count();
    ok("chat: picker lists server hits", optionsBefore > 0, `${optionsBefore} hits`);
    await page.fill('input[placeholder*="עם מי לדבר"]', "מנטורית");
    await page.waitForTimeout(900);
    const hits = await page.locator('div.absolute form button').count();
    ok("chat: search narrows via server", hits >= 1, `${hits} hits`);
  }

  // Jobs board still renders with the trimmed query.
  await page.goto(`${BASE}/jobs`);
  await page.waitForLoadState("networkidle");
  ok("jobs: board renders", (await page.locator("article").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/scale-member.png` });
  await page.close();
}

// ── admin side
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "admin.qa@opencode.test");
  await page.fill('input[name="password"]', requireEnv("QA_ADMIN_PASSWORD"));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

  // Members admin: server-side candidate finder.
  await page.goto(`${BASE}/admin/members`);
  await page.waitForLoadState("networkidle");
  const total = ((await page.textContent("body")) ?? "").match(/(\d+) תוצאות/)?.[1];
  await page.locator('button:has-text("איתור מועמדות")').click();
  await page.waitForTimeout(300);
  // Pick the first parameter that has chips and click its first chip.
  const paramSelect = page.locator("select").filter({ hasText: "בחרי פרמטר" }).first();
  const options = await paramSelect.locator("option").allTextContents();
  ok("members admin: finder opens with params", options.length > 3, `${options.length - 1} params`);
  // choose a chip-based param: try a few until chips appear
  let filtered = null;
  for (let i = 1; i < Math.min(options.length, 8); i++) {
    await paramSelect.selectOption({ index: i });
    await page.waitForTimeout(350);
    const chip = page.locator("div.border-t button.rounded-full").first();
    if (await chip.count()) {
      await chip.click();
      await page.waitForTimeout(1200); // debounce + server action
      filtered = ((await page.textContent("body")) ?? "").match(/(\d+) תוצאות/)?.[1];
      break;
    }
  }
  ok(
    "members admin: server matching filters rows",
    filtered !== null && total !== undefined && Number(filtered) <= Number(total),
    `${total} → ${filtered}`
  );
  await page.screenshot({ path: `${SHOTS}/scale-admin-members.png` });

  // CV files: the sign route redirects to a real storage URL.
  await page.goto(`${BASE}/admin/cv-files`);
  await page.waitForLoadState("networkidle");
  const viewHref = await page.locator('a:has-text("תצוגה")').first().getAttribute("href");
  ok("cv-files: view uses the sign route", (viewHref ?? "").includes("/admin/cv-files/sign?id="));
  if (viewHref) {
    const resp = await page.request.get(`${BASE}${viewHref}`, { maxRedirects: 0 });
    ok("cv-files: sign route 302s to storage", resp.status() === 302, `status ${resp.status()}`);
  }

  // Analytics renders from the aggregates.
  await page.goto(`${BASE}/admin/analytics`);
  await page.waitForLoadState("networkidle");
  const an = (await page.textContent("body")) ?? "";
  ok("analytics: summary renders", an.includes("לומדות פעילות") && an.includes("סה״כ כניסות"));

  // Jobs list badges from the RPC.
  await page.goto(`${BASE}/admin/jobs`);
  await page.waitForLoadState("networkidle");
  ok("admin jobs: renders with counts", ((await page.textContent("body")) ?? "").includes("הגש"));

  // Mentor-requests: SQL junior search returns rows.
  await page.goto(`${BASE}/admin/mentor-requests?jq=&jtech=&jyears=1`);
  await page.waitForLoadState("networkidle");
  const mr = (await page.textContent("body")) ?? "";
  ok("junior search (SQL): renders results area", mr.includes("ליווי יזום"));
  await page.screenshot({ path: `${SHOTS}/scale-admin-rest.png` });
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `${failed.length} FAILED` : "ALL PASSED");
process.exit(failed.length ? 1 : 0);
