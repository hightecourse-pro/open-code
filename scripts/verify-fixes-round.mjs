// The owner's small-fixes round (2026-08-29), verified on staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p, x = "") => results.push(`${p ? "✅" : "❌"} ${n}${x ? " — " + x : ""}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

// 1x1 red PNG as a data URI — what a pasted image looks like to the editor.
const RED_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

// ── public homepage copy
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const body = (await page.textContent("body")) ?? "";
  ok("hero: new inclusive line", body.includes("קהילה חמה ותומכת שתלווה אותך עד למשרה"));
  ok("hero: old juniors-only line gone", !body.includes("מהצעד הראשון ועד המשרה הראשונה"));
  ok("card: פיד removed", !body.includes("פיד, פורום"));
  ok("card: הייטקורס courses", body.includes("קורסים מקצועיים של הייטקורס"));
  ok("card: mentors עד להשתלבות", body.includes("עד להשתלבות בעבודה"));
  ok("card: AI in CV checker", body.includes("ניתוח AI חכם"));
  ok("card: no voice mention", !body.includes("(גם קולי!)"));
  await page.screenshot({ path: `${SHOTS}/fixes-1-home.png` });
  await page.close();
}

// ── member: interview offline + mentor pool notice
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "sub.test@opencode.test");
  await page.fill('input[name="password"]', requireEnv("VERIFY_FIXTURE_PASSWORD"));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

  await page.goto(`${BASE}/ai/interview`);
  await page.waitForLoadState("networkidle");
  const iv = (await page.textContent("body")) ?? "";
  ok("interview: בקרוב screen", iv.includes("בקרוב") && iv.includes("משדרגות את סימולטור"));
  ok("interview: no setup form", (await page.locator('button:has-text("התחלת ראיון")').count()) === 0);
  await page.screenshot({ path: `${SHOTS}/fixes-2-interview.png` });

  await page.goto(`${BASE}/ai/interview/eacb500f-9b4e-419b-8bd7-f5d024914047`);
  await page.waitForLoadState("networkidle");
  ok("interview: old session link redirects", page.url().endsWith("/ai/interview"));

  await page.goto(`${BASE}/mentor`);
  await page.waitForLoadState("networkidle");
  const mp = (await page.textContent("body")) ?? "";
  ok("mentor: new pool-notice copy", mp.includes("מאגר המנטוריות שלנו בבנייה — בקרוב כאן בשבילך"));

  // profile wizard: specialization question gone
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  await page.locator('button:has-text("אני בתחילת הדרך")').click().catch(() => {});
  await page.waitForTimeout(400);
  ok("wizard: 'מה התחום שלך?' gone", (await page.locator('text=מה התחום שלך?').count()) === 0);
  await page.close();
}

// ── mentor wizard: tech before GitHub
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "mentor.test@opencode.test");
  await page.fill('input[name="password"]', requireEnv("VERIFY_FIXTURE_PASSWORD"));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  // All steps stay mounted — DOM order is the wizard order.
  const labels = await page.locator("label, .font-medium").allTextContents();
  const iTech = labels.findIndex((t) => t.includes("הטכנולוגיות שאת חזקה בהן"));
  const iGit = labels.findIndex((t) => t.includes("קישורים ל-GitHub"));
  ok("mentor wizard: tech before GitHub", iTech > -1 && iGit > -1 && iTech < iGit, `tech@${iTech} git@${iGit}`);
  await page.close();
}

// ── admin: article with a pasted image survives saving
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "admin.qa@opencode.test");
  await page.fill('input[name="password"]', requireEnv("QA_ADMIN_PASSWORD"));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  await page.goto(`${BASE}/admin/articles`);
  await page.waitForLoadState("networkidle");
  await page.locator('button:has-text("מאמר חדש")').click();
  await page.waitForSelector("#ar-title", { timeout: 15000 });

  const title = `בדיקת תמונה ${Date.now()}`;
  await page.fill("#ar-title", title);
  // Put a data-URI image straight into the rich editor — the paste scenario.
  await page.evaluate((src) => {
    const ed = document.querySelector('[contenteditable="true"]');
    if (ed) {
      ed.innerHTML = `<p>טקסט לפני</p><img src="${src}" /><p>טקסט אחרי</p>`;
      // React mirrors the editor on input events — raw innerHTML alone
      // never reaches the submitted form.
      ed.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }, RED_PIXEL);
  await page.locator('button:has-text("פרסום המאמר"), button:has-text("שמירה כטיוטה"), button[type="submit"]').first().click();
  await page.waitForSelector("#ar-title", { state: "detached", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForLoadState("networkidle");
  const row = page.locator(`text=${title}`).first();
  ok("article: created", (await row.count()) > 0);
  // The stored body must hold a hosted https image, not data: and not nothing.
  const opened = await row.click().then(() => true).catch(() => false);
  await page.waitForTimeout(800);
  const html = await page.content();
  const hosted = /article-images\/[^"']+\.(png|jpg|gif|webp)/.test(html);
  ok("article: image hosted (not stripped)", hosted, opened ? "editor opened" : "list html");
  await page.screenshot({ path: `${SHOTS}/fixes-3-article.png` });
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `${failed.length} FAILED` : "ALL PASSED");
process.exit(failed.length ? 1 : 0);
