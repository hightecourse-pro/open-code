// The mentor acceptance flow, end to end on deployed staging:
// member requests → admin assigns → member still sees nothing → mentor
// accepts → member sees her mentor → admin history shows "אישרה" + bonus.
import { chromium } from "@playwright/test";
const PASS = process.env.VERIFY_FIXTURE_PASSWORD;
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD;
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

// ── 1: member sends a request; the pool notice shows ─────────────────────────
const member = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await login(member, "sub.test@opencode.test", PASS);
await member.goto(`${BASE}/mentor`);
await member.waitForLoadState("networkidle");
ok("member: pool-building notice", ((await member.textContent("body")) ?? "").includes("מאגר המנטוריות"));
const hasForm = (await member.locator('button:has-text("שליחת בקשה למנטורית")').count()) > 0;
if (hasForm) {
  await member.selectOption("#mr-reason", { index: 1 });
  await member.locator('button:has-text("שליחת בקשה למנטורית")').click({ force: true });
  await member.waitForTimeout(2000);
}
ok("member: request sent", hasForm);

// ── 2: admin assigns mentor.test ─────────────────────────────────────────────
const admin = await browser.newPage({ viewport: { width: 1500, height: 950 } });
admin.on("dialog", (d) => d.accept());
await login(admin, "admin.qa@opencode.test", ADMIN_PASS);
await admin.goto(`${BASE}/admin/mentor-requests`);
await admin.waitForLoadState("networkidle");
const reqRow = admin.locator('div:has-text("מנויה בדיקה")').locator("select").first();
// Option labels carry field+load now ("מנטורית בדיקה · פולסטאק · פנויה") —
// resolve the option by contained text and select by value.
const mentorOpt = reqRow.locator("option", { hasText: "מנטורית בדיקה" }).first();
await reqRow.selectOption((await mentorOpt.getAttribute("value")) ?? "");
await admin.locator('button:has-text("שיוך מנטורית")').first().click();
await admin.waitForTimeout(2000);
await admin.reload();
await admin.waitForLoadState("networkidle");
ok("admin: assigned shows ממתין לאישור", ((await admin.textContent("body")) ?? "").includes("ממתין לאישור שלה"));

// ── 3: member still sees NOTHING (mentor hasn't accepted) ────────────────────
await member.goto(`${BASE}/mentor`);
await member.waitForLoadState("networkidle");
const memberBody1 = (await member.textContent("body")) ?? "";
ok("member: mentor NOT visible before acceptance", !memberBody1.includes("מנטורית בדיקה"));
ok("member: honest waiting copy", memberBody1.includes("הבקשה שלך אצלנו"));

// ── 4: the mentor sees the invite and accepts ────────────────────────────────
const mentor = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await login(mentor, "mentor.test@opencode.test", PASS);
await mentor.goto(`${BASE}/mentor`);
await mentor.waitForLoadState("networkidle");
ok("mentor: invite waiting", ((await mentor.textContent("body")) ?? "").includes("שיבוצים שמחכים לאישור שלך"));
await mentor.screenshot({ path: `${SHOTS}/mentor-invite.png` });
await mentor.locator('button:has-text("אני מקבלת את הליווי")').first().click();
await mentor.waitForTimeout(2500);
await mentor.reload();
await mentor.waitForLoadState("networkidle");
ok("mentor: now in הליוויים שלי", ((await mentor.textContent("body")) ?? "").includes("מנויה בדיקה"));

// ── 5: member NOW sees her mentor ────────────────────────────────────────────
await member.goto(`${BASE}/mentor`);
await member.waitForLoadState("networkidle");
ok("member: mentor visible after acceptance", ((await member.textContent("body")) ?? "").includes("מנטורית בדיקה"));
await member.screenshot({ path: `${SHOTS}/mentor-visible.png` });

// ── 6: admin history + bonus ─────────────────────────────────────────────────
await admin.goto(`${BASE}/admin/mentors`);
await admin.waitForLoadState("networkidle");
// The list holds real mentors too — anchor everything to OUR fixture's card,
// not to whichever mentor happens to render first.
const mentorCard = admin.locator("div.bg-white").filter({ hasText: "מנטורית בדיקה" }).first();
await mentorCard.locator('button:has-text("היסטוריית ליוויים")').first().click();
await admin.waitForTimeout(300);
const cardText = (await mentorCard.textContent()) ?? "";
ok("admin: history row with אישרה", cardText.includes("אישרה"));
await mentorCard.locator('button:has-text("בונוס")').first().click();
await admin.fill('input[name="points"]', "50");
await admin.fill('input[name="reason"]', "בדיקת בונוס");
await admin.locator('button:has-text("הוספת בונוס")').click();
await admin.waitForTimeout(1500);
await admin.reload();
await admin.waitForLoadState("networkidle");
ok("admin: bonus in breakdown", ((await admin.textContent("body")) ?? "").includes("50 בונוס"));
await admin.screenshot({ path: `${SHOTS}/mentor-admin.png` });

// ── 7: config toggle exists ──────────────────────────────────────────────────
await admin.goto(`${BASE}/admin/config`);
await admin.waitForLoadState("networkidle");
ok("config: pool-notice toggle", ((await admin.textContent("body")) ?? "").includes("מאגר המנטוריות בבנייה"));

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
