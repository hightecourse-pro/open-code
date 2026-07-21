// Runs once after every Playwright run: sweep the artifacts the specs create
// (forum posts, E2E TestCo jobs, E2E courses) so test runs never leave junk
// that real members would see.
import { execSync } from "child_process";

export default function globalTeardown() {
  try {
    execSync("node --env-file=.env.local scripts/cleanup-e2e-data.mjs", { stdio: "inherit" });
  } catch (err) {
    console.warn("e2e cleanup failed (non-fatal):", err?.message ?? err);
  }
}
