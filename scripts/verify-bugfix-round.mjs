// Browser verification of the owner's bug round on deployed staging.
// Fixtures: scratchpad seed-bugfix-verify.mjs (two closed BUGFIX-verify jobs).
import { chromium } from "@playwright/test";
const PASS = process.env.VERIFY_FIXTURE_PASSWORD ?? (() => { console.error("set VERIFY_FIXTURE_PASSWORD"); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sub.test@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

// 1 ─ bi-weekly wording
await page.goto(`${BASE}/events`);
await page.waitForLoadState("networkidle");
ok("events: bi-weekly wording", (await page.locator("text=אחת לשבועיים").count()) > 0);
await page.goto(`${BASE}/recordings`);
await page.waitForLoadState("networkidle");
ok("recordings: bi-weekly wording", (await page.locator("text=דו-שבועיים").count()) > 0);

// 2 ─ ההגשות שלי: closed jobs under הסתיימו with honest tags
await page.goto(`${BASE}/jobs?view=mine`);
await page.waitForLoadState("networkidle");
const doneGroup = page.locator("div.bg-white", { hasText: "הסתיימו" }).last();
const doneText = (await doneGroup.textContent()) ?? "";
ok("mine: filled job in הסתיימו", doneText.includes("משרה שאוישה (בדיקה)"));
ok("mine: filled job tagged המשרה אוישה", doneText.includes("המשרה אוישה"));
ok("mine: no-hire job in הסתיימו", doneText.includes("משרה שנסגרה (בדיקה)"));
ok("mine: no-hire job tagged המשרה נסגרה", doneText.includes("המשרה נסגרה"));
const reviewGroup = page.locator("div.bg-white", { hasText: "אצלנו בבדיקה" }).first();
const reviewText = (await reviewGroup.count()) ? (await reviewGroup.textContent()) ?? "" : "";
ok("mine: closed jobs NOT in בבדיקה", !reviewText.includes("בדיקה)"));
// pill count equals visible rows
const pillMatch = /ההגשות שלי \((\d+)\)/.exec((await page.textContent("body")) ?? "");
const rowCount = await page.locator("div.bg-white span.text-\\[13\\.5px\\]").count();
ok(`mine: pill count matches rows (${pillMatch?.[1]} vs ${rowCount})`, !!pillMatch && Number(pillMatch[1]) === rowCount);
await page.screenshot({ path: `${SHOTS}/bugfix-mine.png` });

// 3 ─ members: specialization/region visible after the backfill
await page.goto(`${BASE}/members`);
await page.waitForLoadState("networkidle");
const membersText = (await page.textContent("body")) ?? "";
ok("members: specialization badges show", membersText.includes("באקאנד") || membersText.includes("פרונטאנד"));
ok("members: region badges show", membersText.includes("מרכז") || membersText.includes("ירושלים"));
await page.screenshot({ path: `${SHOTS}/bugfix-members.png` });

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
