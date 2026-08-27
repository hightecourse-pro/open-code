// External-payments round, on deployed staging:
//  1. a webhook from an UNRECOGNIZED caller (this machine) with our mosad
//     number → stored flagged, nobody activated;
//  2. /admin/payments shows it with the review badge; approve keeps it
//     waiting (no member with that email); assign activates the fixture.
import { chromium } from "@playwright/test";
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD;
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);

// ── 1: the graceful webhook path ─────────────────────────────────────────────
const res = await fetch(`${BASE}/api/webhooks/payments`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    MosadNumber: "7017683",
    Amount: "39.00",
    Tashloumim: "",
    Mail: "ext-verify@example.com",
    ClientName: "בדיקת מקור לא מזוהה",
    Phone: "050-0000000",
    TransactionId: "EXTV-UNVERIFIED-1",
    Groupe: "דמי מנוי - קהילת קוד פתוח",
  }),
});
const body = await res.json().catch(() => ({}));
ok(`webhook: stored not rejected (${res.status} ${body.outcome ?? body.error ?? ""})`,
  res.ok && body.outcome === "external_stored_unverified");

// ── 2: the admin screen ──────────────────────────────────────────────────────
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("dialog", (d) => d.accept());
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin.qa@opencode.test");
await page.fill('input[name="password"]', ADMIN_PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/admin/payments`);
await page.waitForLoadState("networkidle");
ok("screen: waiting list", (await page.locator("text=מחכות לבעלים").count()) > 0);
ok("screen: the unverified row", (await page.locator("text=בדיקת מקור לא מזוהה").count()) > 0);
ok("screen: review badge", (await page.locator("text=ממתין לאישור — מקור לא מזוהה").count()) > 0);
ok("screen: waiting-since", ((await page.textContent("body")) ?? "").includes("מחכה"));
await page.screenshot({ path: `${SHOTS}/payments-screen.png` });

// approve → stays waiting (no member with that email), now assignable
await page.locator('div:has-text("בדיקת מקור לא מזוהה")').locator('button:has-text("אישור התשלום")').first().click();
await page.waitForTimeout(1500);
await page.reload();
await page.waitForLoadState("networkidle");
ok("approve: badge cleared, assign control shows",
  (await page.locator("text=ממתין לאישור — מקור לא מזוהה").count()) === 0 &&
    (await page.locator('select[aria-label="שיוך לחברה"]').count()) > 0);

// assign to the checkout-probe fixture (pending member → activation is real)
const row = page.locator('div.py-3:has-text("בדיקת מקור לא מזוהה")');
await row.locator("select").selectOption({ label: "בודקת צ'ק-אאוט" });
await row.locator('button:has-text("שיוך ✓")').click();
await page.waitForTimeout(2000);
await page.reload();
await page.waitForLoadState("networkidle");
ok("assign: row left the waiting list", (await page.locator('div.py-3:has-text("בדיקת מקור לא מזוהה")').count()) === 0);
await page.locator('button:has-text("שויכו (")').click();
ok("assign: shows in claimed history", (await page.locator("text=בדיקת מקור לא מזוהה").count()) > 0);
await page.screenshot({ path: `${SHOTS}/payments-claimed.png` });

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
