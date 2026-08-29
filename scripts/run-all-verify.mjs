// Run every staging verify-* script in sequence and summarize ✅/❌ lines.
// Prod scripts are excluded — this runner must never mutate production.
import { spawnSync } from "child_process";
import { readdirSync } from "fs";

const SKIP = new Set([
  "verify-prod-demo.mjs", // prod + needs SHIRA/GRTH passwords
  "verify-prod-pm4.mjs", // prod
  "verify-prod-public.mjs", // prod (run separately, read-only)
  "verify-shira-prod-smoke.mjs", // prod + needs SHIRA_PASSWORD
]);
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const scripts = readdirSync("scripts")
  .filter((f) => f.startsWith("verify-") && f.endsWith(".mjs") && !SKIP.has(f) && f !== "run-all-verify.mjs")
  .filter((f) => !only || only.test(f))
  .sort();

const summary = [];
for (const s of scripts) {
  const t0 = Date.now();
  const r = spawnSync("node", [`scripts/${s}`], {
    encoding: "utf8",
    timeout: 180_000,
    env: process.env,
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const pass = (out.match(/✅/g) ?? []).length;
  const fail = (out.match(/❌/g) ?? []).length;
  const crashed = r.status !== 0 && fail === 0;
  summary.push({ s, pass, fail, crashed, secs: Math.round((Date.now() - t0) / 1000) });
  console.log(`\n===== ${s} (exit ${r.status}, ${summary.at(-1).secs}s) =====`);
  // Print only the meaningful lines to keep the log readable.
  for (const line of out.split("\n")) {
    if (/✅|❌|Error|error|failed|FAIL|Timeout|timeout/.test(line)) console.log("  " + line.slice(0, 300));
  }
}

console.log("\n\n================ SUMMARY ================");
for (const r of summary) {
  const flag = r.crashed ? "💥 CRASH" : r.fail > 0 ? "❌ FAIL" : "✅";
  console.log(`${flag}  ${r.s}  (${r.pass}✅ / ${r.fail}❌, ${r.secs}s)`);
}
