// Prove the checkout now hands Nedarim an UNLIMITED standing order: the
// transaction fields serialized into /join must carry Tashlumim:"" (and no
// Tashlumim:"1" anywhere).
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "checkout.probe@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
await page.goto(`${BASE}/join`);
await page.waitForLoadState("networkidle");
const html = await page.content();
const unlimited = html.includes('\\"Tashlumim\\":\\"\\"') || html.includes('"Tashlumim":""');
const limited = html.includes('\\"Tashlumim\\":\\"1\\"') || html.includes('"Tashlumim":"1"');
const hk = html.includes("HK");
console.log("Tashlumim empty (unlimited):", unlimited ? "✅" : "❌");
console.log("Tashlumim '1' still present:", limited ? "❌ YES" : "✅ gone");
console.log("PaymentType HK present:", hk ? "✅" : "❌");
await browser.close();
