// Real-browser verification of the Shira admin round (2026-08-28) on staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p, x = "") => results.push(`${p ? "✅" : "❌"} ${n}${x ? " — " + x : ""}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin.qa@opencode.test");
await page.fill('input[name="password"]', requireEnv("QA_ADMIN_PASSWORD"));
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

// ── 1. sidebar sections
await page.goto(`${BASE}/admin`);
await page.waitForLoadState("networkidle");
const nav = (await page.locator("nav").first().textContent()) ?? "";
ok("menu: 5 section titles", ["קהילה", "ליווי", "השמה", "תוכן", "מערכת"].every((t) => nav.includes(t)));
ok("menu: renamed items", nav.includes("פניות לצוות") && nav.includes("נתוני למידה") && nav.includes("הרשאות לתכנים"));
ok("menu: רשימת הגשות item", nav.includes("רשימת הגשות"));
await page.screenshot({ path: `${SHOTS}/shira-1-menu.png` });

// ── 2. alerts
await page.goto(`${BASE}/admin/alerts`);
await page.waitForLoadState("networkidle");
const alertsBody = (await page.textContent("body")) ?? "";
ok("alerts: filter pills", alertsBody.includes("לא נקרא") && alertsBody.includes("אזהרות"));
ok("alerts: search box", (await page.locator('input[placeholder="חיפוש בהתראות…"]').count()) === 1);
const actionBtns = await page.locator('a:has-text("למסך התשלומים"), a:has-text("לתור השיתופים"), a:has-text("לפניות לצוות"), a:has-text("לדף שלה"), a:has-text("לרישום ידני")').count();
ok("alerts: action buttons on alerts", actionBtns > 0, `${actionBtns} buttons`);
ok("alerts: day headers", /היום|אתמול|השבוע|מוקדם יותר/.test(alertsBody));
await page.screenshot({ path: `${SHOTS}/shira-2-alerts.png` });

// ── 3. team inbox
await page.goto(`${BASE}/admin/requests`);
await page.waitForLoadState("networkidle");
const inboxBody = (await page.textContent("body")) ?? "";
ok("inbox: renamed פניות לצוות", inboxBody.includes("פניות לצוות"));
ok("inbox: settings section", inboxBody.includes("שמות הצוות ותשובות מוכנות"));
ok("inbox: period filters", inboxBody.includes("שבוע") && inboxBody.includes("חודש"));
await page.screenshot({ path: `${SHOTS}/shira-3-inbox.png` });

// ── 4. cv files
await page.goto(`${BASE}/admin/cv-files`);
await page.waitForLoadState("networkidle");
const cvBody = (await page.textContent("body")) ?? "";
ok("cv: split filters", cvBody.includes("כל שפה") && cvBody.includes("כל סוג"));
ok("cv: type column", cvBody.includes("PDF") || cvBody.includes("Word"));
ok("cv: preview button", (await page.locator('a:has-text("תצוגה")').count()) > 0);
ok("cv: last-updated header", cvBody.includes("עדכון אחרון"));
await page.screenshot({ path: `${SHOTS}/shira-4-cv.png` });

// ── 5. jobs review center (Junior Fullstack has applications-free state OK)
await page.goto(`${BASE}/admin/jobs/266739e7-e977-4504-bfc1-d537d3f736cc?tab=review`);
await page.waitForLoadState("networkidle");
const jobBody = (await page.textContent("body")) ?? "";
ok("job: מנויות tile", jobBody.includes("מנויות"));
ok("job: VIP tile", jobBody.includes("VIP"));
ok("job: team-note box", jobBody.includes("הערה שלנו למשרה"));
ok("job: excel export", jobBody.includes("ייצוא לאקסל"));
await page.screenshot({ path: `${SHOTS}/shira-5-job.png` });

// ── 6. submissions screen
await page.goto(`${BASE}/admin/submissions`);
await page.waitForLoadState("networkidle");
const subBody = (await page.textContent("body")) ?? "";
ok("submissions: renders", subBody.includes("רשימת הגשות"));
ok("submissions: export", subBody.includes("ייצוא לאקסל"));
await page.screenshot({ path: `${SHOTS}/shira-6-submissions.png` });

// ── 7. mentor requests
await page.goto(`${BASE}/admin/mentor-requests`);
await page.waitForLoadState("networkidle");
const mrBody = (await page.textContent("body")) ?? "";
ok("mentor-req: renamed בקשות לליווי", mrBody.includes("בקשות לליווי"));
ok("mentor-req: proactive search explains itself", mrBody.includes("ליווי יזום"));
await page.screenshot({ path: `${SHOTS}/shira-7-mentor-requests.png` });

// ── 8. mentors screen
await page.goto(`${BASE}/admin/mentors`);
await page.waitForLoadState("networkidle");
const mBody = (await page.textContent("body")) ?? "";
ok("mentors: availability badges", /פנויה לשיבוץ|ליווי פעיל|לא זמינה כרגע/.test(mBody));
ok("mentors: search box", (await page.locator('input[placeholder="חיפוש מנטורית…"]').count()) === 1);
ok("mentors: reason-required cancel (button)", mBody.includes("ביטול המינוי"));
await page.screenshot({ path: `${SHOTS}/shira-8-mentors.png` });

// ── 9. sessions + content + config folds
await page.goto(`${BASE}/admin/sessions`);
await page.waitForLoadState("networkidle");
ok("sessions: creation folded", (await page.locator('button:has-text("סשן חדש")').count()) >= 1 && (await page.locator("#s-title").isVisible().catch(() => false)) === false);
await page.goto(`${BASE}/admin/content`);
await page.waitForLoadState("networkidle");
const collapsedCourses = await page.locator('button:has(svg.-rotate-90)').count();
ok("content: cards folded by default", collapsedCourses > 0, `${collapsedCourses} closed`);
await page.goto(`${BASE}/admin/config`);
await page.waitForLoadState("networkidle");
ok("config: topics folded", (await page.locator('button:has-text("דמי מנוי")').count()) === 1 && (await page.locator("text=המחיר שחברות חדשות").isVisible().catch(() => false)) === false);
await page.screenshot({ path: `${SHOTS}/shira-9-config.png` });

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
