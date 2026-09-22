// Staging sanity - runs after EVERY staging deploy (the owner, 17/9: "סניטי
// על כל מה שרלוונטי בכל דחיפה"). Real browser, real pages, asserts on what
// rendered. Exit 1 on any failure. Credentials = the staging test accounts
// documented in the QA spec (חשבונות הבדיקה); override via env if rotated.
import { chromium } from "playwright";

const BASE = process.env.SANITY_BASE ?? "https://open-code-psi.vercel.app";
const ADMIN = { email: "admin.qa@opencode.test", password: process.env.SANITY_ADMIN_PASSWORD ?? "Nihul-Kehila-2026!vR7" };
const MEMBER = { email: "sub.test@opencode.test", password: process.env.SANITY_MEMBER_PASSWORD ?? "Vrfy-2026!kQ83zW" };
const MIRIAM = "7a52f440-41a8-4846-9bc3-e34cf7569c84"; // demo graduate with a full profile
const JOB = "e03cc818-78c7-4a82-9d72-fc8055f02500"; // job she applied to

const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " - " + extra : ""}`);
const browser = await chromium.launch();

async function login(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="password"]', who.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.href.includes("/login"), { timeout: 45000 });
}

try {
  // ── public
  for (const [path, needle] of [["/", "קוד פתוח"], ["/login", "כניסה"], ["/coordinator/login", "שליחת קוד כניסה"], ["/hackathon-2026", "האקתון"]]) {
    const r = await fetch(`${BASE}${path}`);
    ok(`public ${path}`, r.status === 200 && (await r.text()).includes(needle), `status=${r.status}`);
  }

  // ── member
  const m = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await login(m, MEMBER);
  await m.goto(`${BASE}/profile/preview`, { waitUntil: "networkidle" });
  const preview = await m.textContent("body");
  ok("member profile preview renders sections", preview.includes("מיומנויות טכניות") || preview.includes("הכשרה ולימודים"));
  await m.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  ok("profile edit: save-every-step button", await m.getByRole("button", { name: "שמירת השינויים ✓" }).isVisible());
  await m.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
  const jobs = await m.textContent("body");
  ok("jobs board renders", jobs.includes("משרות") && !jobs.includes("מצומצמת"));
  await m.goto(`${BASE}/subscription`, { waitUntil: "networkidle" });
  ok("subscription page renders", (await m.textContent("body")).includes("המנוי שלי"));

  // ── admin
  const a = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  await login(a, ADMIN);
  await a.goto(`${BASE}/admin/members/${MIRIAM}/profile`, { waitUntil: "networkidle" });
  const prof = await a.textContent("body");
  ok("admin full profile: sections render (the 17/9 incident)", ["מיומנויות טכניות", "ניסיון תעסוקתי", "הכשרה ולימודים"].every((s) => prof.includes(s)));
  await a.goto(`${BASE}/admin/jobs/${JOB}?tab=review`, { waitUntil: "networkidle" });
  const rc = await a.textContent("body");
  ok("review center renders applicants", rc.includes("מרים רוס"));
  await a.goto(`${BASE}/admin/coordinators`, { waitUntil: "networkidle" });
  ok("admin coordinators renders", (await a.textContent("body")).includes("רכזות מוסדות"));
  await a.goto(`${BASE}/admin/hires`, { waitUntil: "networkidle" });
  ok("admin hires renders with seminary badges", (await a.textContent("body")).includes("🎓"));
  await a.goto(`${BASE}/admin/mentors`, { waitUntil: "networkidle" });
  ok("admin mentors tabs", (await a.locator('[role="tab"]').count()) >= 3);
  await a.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  ok("admin dashboard renders", (await a.textContent("body")).includes("דשבורד") || (await a.textContent("body")).includes("התראות"));
} catch (e) {
  out.push(`FAIL crashed - ${String(e).slice(0, 200)}`);
} finally {
  await browser.close();
}
console.log("===== STAGING SANITY =====");
for (const r of out) console.log(r);
const fails = out.filter((r) => r.startsWith("FAIL")).length;
console.log(`${out.length - fails}/${out.length} passed`);
process.exit(fails ? 1 : 0);
