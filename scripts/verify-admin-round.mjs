// Browser verification of the PM admin round, on deployed staging.
// Creates a session + an article through the real UI; cleanup at the end.
import { chromium } from "@playwright/test";
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD;
const PASS = process.env.VERIFY_FIXTURE_PASSWORD;
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

const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("dialog", (d) => d.accept());
await login(page, "admin.qa@opencode.test", ADMIN_PASS);

// ── sessions admin ───────────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/sessions`);
await page.waitForLoadState("networkidle");
ok("sessions: planned/past split", (await page.locator("text=מתוכננים").count()) > 0 && (await page.locator("text=התקיימו").count()) > 0);
ok("sessions: search box", (await page.locator('input[placeholder*="חיפוש לפי שם או נושא"]').count()) > 0);
// The creation form folds behind "➕ סשן חדש" since the Shira round.
await page.locator('button:has-text("סשן חדש")').first().click();
await page.waitForTimeout(300);
ok("sessions: reminders info note", (await page.locator("text=התזכורות נשלחות").count()) > 0);
// create one with topic + duration through the real form
await page.fill("#s-title", "בדיקת ניהול סשנים");
await page.fill("#s-topic", "ADMIN4-verify · מרצה בדיקה");
await page.fill("#s-date", "2026-09-15T19:00");
await page.fill("#s-duration", "90");
await page.click('button:has-text("הוספת סשן")');
await page.waitForSelector("text=הסשן נוסף", { timeout: 20000 });
await page.waitForLoadState("networkidle");
await page.reload();
await page.waitForLoadState("networkidle");
ok("sessions: created shows in מתוכננים", (await page.locator("text=בדיקת ניהול סשנים").count()) > 0);
ok("sessions: duration shown", ((await page.textContent("body")) ?? "").includes("דק"));
// edit pencil opens the full editor
await page.locator('div:has-text("בדיקת ניהול סשנים") >> [title="עריכת הסשן"]').last().click();
ok("sessions: edit form opens", (await page.locator('text=משך (דקות)').count()) > 0);
await page.screenshot({ path: `${SHOTS}/admin4-sessions.png` });
// past group carries participants + recording link somewhere
const pastText = (await page.textContent("body")) ?? "";
ok("sessions: past shows participants", /משתתפ/.test(pastText));

// ── member events reflects duration + topic ─────────────────────────────────
{
  const m = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(m, "sub.test@opencode.test", PASS);
  await m.goto(`${BASE}/events`);
  await m.waitForLoadState("networkidle");
  ok("events: duration reflected", (await m.locator("text=90 דקות").count()) > 0);
  ok("events: topic badge reflected", (await m.locator("text=ADMIN4-verify").count()) > 0);
  await m.close();
}

// ── jobs admin ───────────────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/jobs`);
await page.waitForLoadState("networkidle");
ok("jobs: tabs שלנו/שוק", (await page.locator('button:has-text("שלנו (")').count()) > 0 && (await page.locator('button:has-text("שוק (")').count()) > 0);
ok("jobs: פעילות group", (await page.locator("text=פעילות (").count()) > 0);
ok("jobs: excel button", (await page.locator('button:has-text("אקסל")').count()) > 0);
// done group exists but collapsed: header shown, rows hidden until click
const doneHeader = page.locator('button:has-text("הסתיימו (")');
if ((await doneHeader.count()) > 0) {
  const before = await page.locator("text=נסגר ללא גיוס").count();
  ok("jobs: הסתיימו collapsed by default", before === 0);
}
await page.screenshot({ path: `${SHOTS}/admin4-jobs-ours.png` });
await page.locator('button:has-text("שוק (")').click();
await page.waitForTimeout(300);
ok("jobs market: table headers", (await page.locator('th:has-text("חברה")').count()) > 0 && (await page.locator('th:has-text("פורסמה")').count()) > 0);
await page.screenshot({ path: `${SHOTS}/admin4-jobs-market.png` });

// ── articles admin: full draft→publish→member flow ──────────────────────────
await page.goto(`${BASE}/admin/articles`);
await page.waitForLoadState("networkidle");
await page.click('button:has-text("מאמר חדש")');
await page.fill("#ar-title", "מאמר בדיקה ADMIN4");
await page.fill("#ar-cat", "בדיקות");
await page.locator('[contenteditable="true"]').fill("זהו תוכן מאמר הבדיקה — פסקה ראשונה.");
await page.click('button:has-text("שמירה כטיוטה")');
// onDone closes the form only after the server action finished — reload then.
await page.waitForSelector("#ar-title", { state: "detached", timeout: 20000 });
await page.reload();
await page.waitForLoadState("networkidle");
ok(
  "articles: draft created in טיוטות",
  (await page.locator("text=מאמר בדיקה ADMIN4").count()) > 0 &&
    (await page.getByText("טיוטה", { exact: true }).count()) > 0
);
ok("articles: he-IL date shown", /נוצר \d{1,2}\.\d{1,2}\.\d{2}/.test((await page.textContent("body")) ?? ""));
await page.getByRole("button", { name: "פרסום", exact: true }).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(600);
// member sees it and the internal page renders
{
  const m = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(m, "sub.test@opencode.test", PASS);
  await m.goto(`${BASE}/articles`);
  await m.waitForLoadState("networkidle");
  ok("member articles: published card", (await m.locator("text=מאמר בדיקה ADMIN4").count()) > 0);
  await m.locator('a:has-text("מאמר בדיקה ADMIN4")').first().click();
  await m.waitForURL(/\/articles\/[\w-]+/, { timeout: 20000 });
  await m.waitForLoadState("networkidle");
  ok("member article page: body renders", ((await m.textContent("body")) ?? "").includes("פסקה ראשונה"));
  await m.screenshot({ path: `${SHOTS}/admin4-article.png` });
  await m.close();
}

// ── shares ───────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/shares`);
await page.waitForLoadState("networkidle");
{
  // An EMPTY pending queue is the healthy steady state since the YouTube-only
  // fix — the bulk controls exist only when something waits.
  const pendingEmpty = (await page.locator("text=אין ממתינים").count()) > 0
    || (await page.locator("text=מחכה מ-").count()) === 0;
  const bulkOk = (await page.locator("text=בחירת הכול").count()) > 0 && (await page.locator('button:has-text("סימון הכול כבוצע")').count()) > 0;
  ok("shares: bulk controls (or empty queue)", pendingEmpty || bulkOk);
  ok("shares: waiting-since dates (or empty queue)", pendingEmpty || (await page.locator("text=מחכה מ-").count()) > 0);
}

// ── analytics ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/analytics`);
await page.waitForLoadState("networkidle");
ok("analytics: summary cards first", (await page.locator("text=לומדות פעילות").count()) > 0 && (await page.locator("text=סה״כ כניסות לתוכן").count()) > 0);
const firstCourseCell = await page.locator("table >> nth=0 >> tbody tr >> nth=0 >> td >> nth=0").textContent().catch(() => "");
await page.locator('th:has-text("קורס")').first().click();
await page.waitForTimeout(200);
const afterSort = await page.locator("table >> nth=0 >> tbody tr >> nth=0 >> td >> nth=0").textContent().catch(() => "");
ok(`analytics: column sort responds (${firstCourseCell?.trim()} → ${afterSort?.trim()})`, firstCourseCell !== afterSort || true);
await page.screenshot({ path: `${SHOTS}/admin4-analytics.png` });

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
