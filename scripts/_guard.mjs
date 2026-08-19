// Every ops script takes its target from whatever env file was passed and
// runs with the service role — RLS does not apply. One of them sets a fixed
// admin password, another deletes rows. Pointed at the wrong project, a single
// run is a backdoor or a data loss. So: every script that writes says WHERE it
// is about to write, and refuses a non-staging target unless the intent is
// spelled out on the command line.
const STAGING_REF = "cgxkoutlicmaygzwkxfa";

export function guardTarget() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = url.match(/https?:\/\/([a-z0-9]+)\.supabase\./)?.[1] ?? "(unknown)";
  const label = ref === STAGING_REF ? "staging" : "NOT STAGING";
  console.log(`[guard] target Supabase project: ${ref} (${label})`);
  if (ref !== STAGING_REF && !process.argv.includes("--i-know-this-is-production")) {
    console.error(
      `[guard] refusing to run: this environment points at "${ref}", which is not the staging project.\n` +
        `[guard] if you truly mean to touch it, run again with --i-know-this-is-production`
    );
    process.exit(1);
  }
}
