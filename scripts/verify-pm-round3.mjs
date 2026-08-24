// Browser verification of PM round 3 on deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const ADMIN_PASS = requireEnv("QA_ADMIN_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);

const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}

// ── member side ──────────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await login(page, "sub.test@opencode.test", PASS);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");

  // menu: order + labels + subscription item
  const navTexts = await page.locator("nav a").allTextContents();
  const idx = (t) => navTexts.findIndex((x) => x.includes(t));
  ok("menu: jobs before events", idx("משרות") > -1 && idx("משרות") < idx("אירועים וסשנים LIVE"));
  ok("menu: events renamed LIVE", idx("אירועים וסשנים LIVE") > -1);
  ok("menu: articles last in section", idx("מאמרים") > idx("הקלטות"));
  ok("menu: המנוי שלי item", idx("המנוי שלי") > -1);

  // session feedback banner
  ok("feedback banner shown", (await page.locator("text=היית איתנו בסשן").count()) > 0);
  await page.locator('button:has-text("כן, הייתי!")').click();
  await page.waitForSelector("text=התוכן עצמו");
  for (const row of ["התוכן עצמו", "כמה זה מעשי", "כמה זה היה מובן", "המרצה"]) {
    const stars = page.locator(`[role="radiogroup"][aria-label="${row}"] button`).nth(3);
    await stars.click();
  }
  await page.screenshot({ path: `${SHOTS}/pm3-1-feedback.png` });
  await page.locator('button:has-text("שליחת המשוב")').click();
  await page.waitForSelector("text=תודה על המשוב", { timeout: 20000 });
  ok("feedback submitted + thanks", true);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  ok("banner gone after answering", (await page.locator("text=היית איתנו בסשן").count()) === 0);

  // floating request widget
  ok("floating request button", (await page.locator('button:has-text("יש לך בקשה?")').count()) === 1);
  await page.locator('button:has-text("יש לך בקשה?")').click();
  await page.fill("#req-subject", "בדיקת ווידג'ט");
  await page.fill("#req-body", "זו בקשת בדיקה מהסקריפט האוטומטי 💜");
  await page.locator('button:has-text("שליחה לצוות")').click();
  await page.waitForSelector("text=קיבלנו!", { timeout: 20000 });
  ok("request sent", true);
  await page.screenshot({ path: `${SHOTS}/pm3-2-request.png` });

  // subscription page + profile without the card
  await page.goto(`${BASE}/subscription`);
  await page.waitForLoadState("networkidle");
  ok("subscription page shows the card", (await page.locator("text=מתחדש אוטומטית ב-").count()) > 0);
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  ok("profile: no subscription card", (await page.locator("text=מתחדש אוטומטית").count()) === 0);
  ok("profile: clear edit header", (await page.locator("text=כאן מעדכנים את הפרופיל").count()) === 1);

  // jobs card: the repeated source line is gone
  await page.goto(`${BASE}/jobs`);
  await page.waitForLoadState("networkidle");
  ok("jobs: no בלעדית line", (await page.locator("text=בלעדית · קוד פתוח").count()) === 0);
  await page.close();
}

// ── the wizard: required CV + the new question (a member with no CV) ─────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "checkout.probe@opencode.test", PASS);
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  // walk to the last step
  const gate = page.locator('button:has-text("אני בתחילת הדרך")');
  if (await gate.count()) await gate.click();
  let sawOffer = false;
  for (let i = 0; i < 10; i++) {
    if (!sawOffer && (await page.locator("text=איזה משרות אפשר להציע לך").count()) > 0) sawOffer = true;
    const next = page.locator('button:has-text("הבא")');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(350);
  }
  if (!sawOffer) sawOffer = (await page.locator("text=איזה משרות אפשר להציע לך").count()) > 0;
  ok("new offerable-roles question in wizard", sawOffer);
  ok("required CV block on final step", (await page.locator("text=קורות חיים (חובה").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/pm3-3-wizard-cv.png` });
  await page.close();
}

// ── admin side: the requests inbox + chat reply ──────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await login(page, "admin.qa@opencode.test", ADMIN_PASS);
  await page.goto(`${BASE}/admin/requests`);
  await page.waitForLoadState("networkidle");
  ok("admin inbox shows the request", (await page.locator("text=בדיקת ווידג'ט").count()) > 0);
  await page.locator('textarea[name="reply"]').first().fill("קיבלנו — הכל טופל, תודה על הבדיקה 💜");
  await page.locator('button:has-text("שליחת תשובה בצ")').first().click();
  await page.waitForTimeout(3500);
  await page.goto(`${BASE}/admin/requests`);
  await page.waitForLoadState("networkidle");
  ok("request marked handled", (await page.locator("text=טופלו (").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/pm3-4-admin-requests.png` });
  await page.close();
}

// ── the reply landed in her chat ─────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "sub.test@opencode.test", PASS);
  await page.goto(`${BASE}/chat`);
  await page.waitForLoadState("networkidle");
  ok("reply reached her chat list", (await page.locator("text=לגבי הבקשה שלך").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/pm3-5-chat-reply.png` });
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
