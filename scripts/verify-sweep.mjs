// Real-browser verification of the morning sweep against deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();

const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const SESSION = "eacb500f-9b4e-419b-8bd7-f5d024914047";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push(`${pass ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

// Tiny but valid-enough PDF for upload flows.
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF"
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// Print whatever was verified even when a step blows up mid-run.
process.on("uncaughtException", (e) => {
  console.log(results.join("\n"));
  console.error("FAILED:", e.message);
  process.exit(1);
});

// login as the QA admin (a full member for these flows)
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin.qa@opencode.test");
await page.fill('input[name="password"]', requireEnv("QA_ADMIN_PASSWORD"));
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

// 1. upload a CV at /cv so the checker has a saved document
await page.goto(`${BASE}/cv`);
// Hydration must finish before the file-change event, or React never sees it
// and the submit button stays on "קודם בחרי קובץ".
await page.waitForLoadState("networkidle");
await page.locator("#file").setInputFiles({ name: "qa-sweep-cv.pdf", mimeType: "application/pdf", buffer: PDF });
await page.locator('button:has-text("שמירת הקובץ")').click();
await page.waitForSelector("text=הקובץ נשמר", { timeout: 20000 });
ok("cv uploaded and saved", true);

// 2. cv-checker: saved-CV chip preselected, upload feedback, no_key alert with next link
await page.goto(`${BASE}/ai/cv-checker`);
await page.waitForLoadState("networkidle");
const savedChip = page.locator('button:has-text("אלה ששמורות אצלנו")');
ok("saved-CV chip shown", (await savedChip.count()) === 1);
ok("saved-CV select shown", (await page.locator("#cv_doc_id").count()) === 1);
await page.screenshot({ path: `${SHOTS}/sweep-1-checker-saved.png` });

await page.locator('button:has-text("קובץ אחר מהמחשב")').click();
await page.locator("#cv_file").setInputFiles({ name: "בדיקה-קוח.pdf", mimeType: "application/pdf", buffer: PDF });
await page.waitForTimeout(300);
ok("picked file name + ✓ shown", (await page.locator("text=נבחר ✓").count()) === 1);
await page.screenshot({ path: `${SHOTS}/sweep-2-checker-picked.png` });

await page.locator('button:has-text("אלה ששמורות אצלנו")').click();
await page.locator('button[type="submit"]:has-text("בדיקת קורות חיים")').click();
await page.waitForSelector('a[href*="/ai/keys"]', { timeout: 25000 });
const keysHref = await page.locator('a[href*="/ai/keys"]').last().getAttribute("href");
ok("no_key alert links back to checker", decodeURIComponent(keysHref ?? "").includes("next=/ai/cv-checker"), keysHref ?? "");
await page.screenshot({ path: `${SHOTS}/sweep-3-checker-nokey.png` });

// 3. interview thread: optimistic bubble + typing row + restore on failure
await page.goto(`${BASE}/ai/interview/${SESSION}`);
await page.waitForLoadState("networkidle");
ok("opening question rendered", (await page.locator("text=ספרי לי קצת על עצמך").count()) > 0);
await page.fill('input[name="answer"]', "יש לי המון מוטיבציה ורקע מריאקט");
await page.click('button[type="submit"]:has-text("שליחה")');
await page.waitForTimeout(250);
const bubbleNow = (await page.locator("text=יש לי המון מוטיבציה").count()) > 0;
const typingNow = (await page.locator("text=המראיינת מקלידה").count()) > 0;
ok("answer bubble appears instantly", bubbleNow);
ok("typing indicator appears", typingNow);
await page.screenshot({ path: `${SHOTS}/sweep-4-interview-optimistic.png` });
// Match ONLY the alert's link (it carries ?next=) — the sidebar's plain
// /ai/keys item also exists on the page.
await page.waitForSelector('a[href*="next="]', { timeout: 25000 });
const sessHref = await page.locator('a[href*="next="]').last().getAttribute("href");
ok("key alert returns to session", decodeURIComponent(sessHref ?? "").includes(`next=/ai/interview/${SESSION}`));
const restored = await page.locator('input[name="answer"]').inputValue();
ok("failed answer restored to box", restored.includes("מוטיבציה"));
await page.screenshot({ path: `${SHOTS}/sweep-5-interview-failed.png` });

// 4. profile form: address trio on one row (desktop)
await page.goto(`${BASE}/profile`);
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${SHOTS}/sweep-6-profile-top.png`, fullPage: false });

// 5. apply form: AI-check link
await page.goto(`${BASE}/jobs/266739e7-e977-4504-bfc1-d537d3f736cc/apply`);
await page.waitForLoadState("networkidle");
ok("apply page offers AI CV check", (await page.locator('a[href="/ai/cv-checker"]:has-text("לבדיקה מהירה")').count()) > 0);
await page.screenshot({ path: `${SHOTS}/sweep-7-apply-link.png` });

// 6. keys page with ?next renders
await page.goto(`${BASE}/ai/keys?next=/ai/cv-checker`);
await page.waitForLoadState("networkidle");
ok("keys page renders with next", (await page.locator("text=הוספת מפתח").count()) > 0);

await browser.close();
console.log(results.join("\n"));
