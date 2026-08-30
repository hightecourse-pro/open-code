// Browser verification of PM round 4 on deployed staging.
// Fixtures: scratchpad seed-pm4-fixtures.mjs (two sessions topic=PM4-verify,
// a manual hire, a custom feedback label) — clean with cleanup-pm4-fixtures.
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page, "sub.test@opencode.test", PASS);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");

  // 8+10+13: sidebar — recordings right after events, chats before המנוי שלי
  const navTexts = (await page.locator("nav a").allTextContents()).map((t) => t.trim());
  const idx = (t) => navTexts.findIndex((x) => x.includes(t));
  ok("menu: recordings right after events", idx("הקלטות סשנים") === idx("אירועים וסשנים LIVE") + 1);
  ok("menu: chats before subscription", idx("צ'אטים") > -1 && idx("צ'אטים") < idx("המנוי שלי"));
  const navBox = await page.locator("nav").boundingBox();
  ok("menu: fits without scroll (~900px)", !!navBox && navBox.height <= 900);

  // 7: search above the composer — which folds behind a button now, so the
  // measured element is the "פתיחת פוסט חדש" button (same slot).
  const searchBox = await page.locator('input[placeholder*="חיפוש לפי מילה"]').boundingBox();
  const composerBox = await page.locator('button:has-text("פתיחת פוסט חדש")').first().boundingBox();
  ok("forum: search above composer", !!searchBox && !!composerBox && searchBox.y < composerBox.y);

  // 6: floating hired banner (fixture 'בדיקת חגיגה') — chip or expanded card
  const hiredChip = await page.locator('button[aria-label*="חברות שהתקבלו"]').count();
  const hiredCard = await page.locator("text=מזל טוב לחברות שלנו").count();
  ok("hired banner floats (chip or card)", hiredChip + hiredCard > 0);
  if (hiredChip > 0) {
    await page.locator('button[aria-label*="חברות שהתקבלו"]').click();
    await page.waitForSelector("text=מזל טוב לחברות שלנו");
    ok("hired banner expands from chip", true);
    await page.locator('button[aria-label="הקטנה"]').click();
    ok("hired banner minimizes", (await page.locator('button[aria-label*="חברות שהתקבלו"]').count()) === 1);
  }

  // 12 + 3: feedback banner carries the session date + the admin-worded label
  ok("feedback banner names the session", (await page.locator("text=בדיקת משוב אוטומטית").count()) > 0);
  const bannerText = await page.locator("text=היית איתנו בסשן").first().textContent();
  ok("feedback banner shows a date", /\(\d{1,2}\.\d{1,2}\)/.test(bannerText ?? ""));
  await page.locator('button:has-text("כן, הייתי!")').click();
  await page.waitForSelector("text=איכות ההדגמות", { timeout: 15000 });
  ok("admin-worded question in banner", true);
  ok("default questions still there", (await page.locator("text=המרצה").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/pm4-1-feedback.png` });
  await page.locator('div:has(> span:text("היית איתנו בסשן")) button[aria-label="סגירה"], button[aria-label="סגירה"]').first().click();

  // 2: forum topic page — side topic rail on wide screens
  const firstTopic = page.locator('a[href^="/forum/"]:not([href="/forum"])').first();
  if ((await firstTopic.count()) > 0) {
    const topicHref = await firstTopic.getAttribute("href");
    await page.goto(`${BASE}${topicHref}`);
    await page.waitForLoadState("networkidle");
    ok("topic page: side rail", (await page.locator("text=עוד בפורום").count()) > 0);
    await page.screenshot({ path: `${SHOTS}/pm4-2-topic-rail.png` });
  } else {
    ok("topic page: side rail (no topics to open)", false);
  }

  // 5: events — live badge, join emphasis, syllabus links, past 'הועבר'
  await page.goto(`${BASE}/events`);
  await page.waitForLoadState("networkidle");
  ok("events: LIVE badge", (await page.locator("text=LIVE עכשיו").count()) > 0);
  ok("events: live join CTA", (await page.locator('text=מצטרפת עכשיו!').count()) > 0);
  ok("events: syllabus download", (await page.locator('a:has-text("סילבוס")').count()) > 0);
  ok("events: materials download", (await page.locator('a:has-text("חומרים")').count()) > 0);
  ok("events: past sessions marked הועבר", (await page.locator("text=הועבר").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/pm4-3-events.png` });

  // 4 + 9: jobs — fit view dims non-matching; no letter logo square
  await page.goto(`${BASE}/jobs?view=fit`);
  await page.waitForLoadState("networkidle");
  ok("jobs(fit): explanation line", (await page.locator("text=מוצגות מעומעמות").count()) > 0);
  const dimmed = await page.locator("article.opacity-65").count();
  // A dimmed card carries ONE closed-door message: the ineligible text, or —
  // when the job moved past submissions (2026-08-30) — the advanced chip.
  const blocked = await page.locator("text=לא ניתן להגיש").count();
  const advancedDimmed = await page
    .locator('article.opacity-65:has-text("המשרה התקדמה לשלב הבא")')
    .count();
  const totalCards = await page.locator("article").count();
  ok(
    `jobs(fit): non-matching dimmed (${dimmed}/${totalCards}, blocked=${blocked}+${advancedDimmed})`,
    totalCards === 0 || dimmed === blocked + advancedDimmed
  );
  ok("jobs: letter logo removed", (await page.locator("article .w-\\[42px\\]").count()) === 0);
  await page.screenshot({ path: `${SHOTS}/pm4-4-jobs-fit.png` });

  // 15: courses syllabus download
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  ok("courses: syllabus button", (await page.locator('a[href="/syllabus-2026.pdf"]').count()) > 0);
  const pdf = await page.request.get(`${BASE}/syllabus-2026.pdf`);
  ok(`courses: PDF serves (${pdf.status()})`, pdf.ok() && (pdf.headers()["content-type"] ?? "").includes("pdf"));

  // 11: profile portal preview
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  ok("profile: preview link", (await page.locator("text=איך אני נראית למגייסות").count()) > 0);
  await page.goto(`${BASE}/profile/preview`);
  await page.waitForLoadState("networkidle");
  ok("preview: page renders", (await page.locator("text=תצוגה מקדימה").count()) > 0);
  const previewHasCard = (await page.locator("text=<מועמדת/>").count()) > 0;
  const previewHasNote = (await page.locator("text=לא מוצג כרגע בפורטל").count()) > 0;
  ok("preview: card or honest empty-state", previewHasCard || previewHasNote);
  await page.screenshot({ path: `${SHOTS}/pm4-5-preview.png` });

  await page.close();
}

// ── admin side ───────────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await login(page, "admin.qa@opencode.test", ADMIN_PASS);

  await page.goto(`${BASE}/admin/config`);
  await page.waitForLoadState("networkidle");
  ok("admin: feedback questions section", (await page.locator("text=שאלות המשוב על סשן").count()) > 0);
  // Settings fold closed by default since the Shira round — open the topic.
  await page.locator('button:has-text("שאלות המשוב על סשן")').click();
  await page.waitForTimeout(250);
  ok("admin: custom label loaded", (await page.locator('input[name="content"]').inputValue()) === "איכות ההדגמות");

  await page.goto(`${BASE}/admin/content`);
  await page.waitForLoadState("networkidle");
  // Session cards fold closed since the Shira round — open the first one.
  await page.locator("section:has(form) button:has(svg.-rotate-90)").last().click().catch(() => {});
  await page.waitForTimeout(300);
  ok("admin content: syllabus input", (await page.locator('input[name="syllabus_url"]').count()) > 0);
  ok("admin content: materials input", (await page.locator('input[name="materials_url"]').count()) > 0);
  await page.screenshot({ path: `${SHOTS}/pm4-6-admin-content.png` });

  await page.close();
}

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
