// Production smoke — runs after EVERY production deploy. No logins, no
// writes: public pages render, gated routes redirect, nothing 500s.
const BASE = process.env.SANITY_BASE ?? "https://app.opencode.org.il";
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
for (const [path, needle] of [["/", "קוד פתוח"], ["/login", "כניסה"], ["/signup", "הצטרפות"], ["/coordinator/login", "שליחת קוד כניסה"], ["/hackathon-2026", "האקתון"], ["/hackathon-2026/partners", "האקתון"], ["/portal/login", "פורטל"]]) {
  const r = await fetch(`${BASE}${path}`);
  ok(`public ${path}`, r.status === 200 && (await r.text()).includes(needle), `status=${r.status}`);
}
for (const path of ["/forum", "/jobs", "/profile", "/subscription", "/admin", "/admin/jobs", "/admin/coordinators", "/coordinator", "/coordinator/jobs", "/portal"]) {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  ok(`gated ${path}`, r.status >= 300 && r.status < 400, `status=${r.status}`);
}
console.log("===== PROD SANITY =====");
for (const r of out) console.log(r);
const fails = out.filter((r) => r.startsWith("FAIL")).length;
console.log(`${out.length - fails}/${out.length} passed`);
process.exit(fails ? 1 : 0);
