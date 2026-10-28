import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { JudgeEntry } from "./judge-entry";

export const metadata: Metadata = { title: "שיפוט הגמר", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * מסך השופטות (the owner, 26/10): one address for all the judges. A judge
 * types her name, picks her challenge and enters the judges' code, and gets
 * her challenge's contestants with her criteria, 1-10 each.
 */
export default async function JudgeEntryPage() {
  const { data } = await createAdminClient().from("hackathon_live_challenges").select("key, name").order("sort", { ascending: true });
  return <JudgeEntry challenges={(data ?? []).map((c) => ({ key: c.key, name: c.name }))} />;
}
