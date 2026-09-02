import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { HiresTable, type HireRow } from "./hires-table";

export const metadata: Metadata = { title: "גיוסים" };
export const dynamic = "force-dynamic";

/**
 * גיוסים (the owner, 3/9): every placement in one place — community members
 * (a row appears the moment she's marked as placed-by-us) and off-community
 * placements added by hand. Each hire carries its billing trail: status
 * (התחילה עבודה → נשלח חשבונית → שולם), the amount, and who pays.
 */
export default async function AdminHiresPage() {
  await requireRole("admin");
  const supabase = await createClient();

  // An off-community hire whose email joined the community since — link her
  // lazily, once, and remember it. Runs here (an admin visit) instead of on
  // every member page render (the Vercel cost round, 3/9).
  {
    const admin = createAdminClient();
    const { data: unlinked } = await admin
      .from("hires")
      .select("id, email")
      .is("profile_id", null)
      .not("email", "is", null)
      .limit(50);
    for (const h of unlinked ?? []) {
      const { data: uid } = await admin.rpc("auth_user_id_by_email", { p_email: h.email! });
      if (uid) await admin.from("hires").update({ profile_id: uid as string }).eq("id", h.id);
    }
  }

  const { data: hires } = await supabase
    .from("hires")
    .select(
      "id, profile_id, full_name, email, company, job_type, source, status, amount, payer, payer_institution, hired_at, created_at"
    )
    .order("hired_at", { ascending: false })
    .limit(1000);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;גיוסים/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">גיוסים 🎉</h1>
        <p className="t-body-sm text-ink-700">
          כל ההשמות במקום אחד — חברות קהילה שגויסו וגם השמות מחוץ לקהילה. לכל גיוס: סטטוס,
          סכום ומי משלמת. השמות מופיעים בבאנר החגיגי למשך 60 יום.
        </p>
      </div>

      <HiresTable
        hires={(hires ?? []) as HireRow[]}
        defaultDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
