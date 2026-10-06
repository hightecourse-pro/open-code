import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * profiles.digest_frequency:
 *   daily  - the daily digest (default)
 *   unread - the digest only when chat messages wait
 *   off    - no daily digest (job announcements still arrive)
 *   none   - no optional email at all (the owner, 6/10): no digest, no
 *            new-job announcements, no session reminders, no chat nudges, no
 *            questionnaire reminders. Personal mail still goes out - her
 *            subscription, her own applications, a note from the team,
 *            password reset.
 */
export const NO_EMAILS = "none";

export function wantsNoEmails(freq: string | null | undefined): boolean {
  return freq === NO_EMAILS;
}

/** Which of these members opted out of every optional email. */
export async function optedOutOfEmails(admin: ReturnType<typeof createAdminClient>, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await admin.from("profiles").select("id").in("id", unique.slice(i, i + 200)).eq("digest_frequency", NO_EMAILS);
    for (const p of data ?? []) out.add(p.id);
  }
  return out;
}
