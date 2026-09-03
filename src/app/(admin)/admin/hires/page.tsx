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

  const [{ data: hires }, { data: clientRows }] = await Promise.all([
    supabase
      .from("hires")
      .select(
        "id, profile_id, full_name, email, company, job_type, source, status, amount, payer, payer_institution, hired_at, created_at, client_id, show_in_banner"
      )
      .order("hired_at", { ascending: false })
      .limit(1000),
    // The company is picked from the clients registry, not typed (the owner, 3/9).
    supabase.from("portal_clients").select("id, company_name").order("company_name"),
  ]);

  // Who is she TODAY (the owner, 3/9: "לזהות מיד בכניסה") — every linked hire
  // gets her live community standing: מנויה, משתתפת רגילה, מנטורית, צוות.
  const linkedIds = [...new Set((hires ?? []).map((h) => h.profile_id).filter((v): v is string => !!v))];
  const { data: linkedProfiles } = linkedIds.length
    ? await supabase.from("profiles").select("id, role, status, member_tier").in("id", linkedIds)
    : { data: [] };
  const membershipOf = new Map<string, string>();
  for (const p of linkedProfiles ?? []) {
    membershipOf.set(
      p.id,
      p.role === "admin"
        ? "team"
        : p.role === "mentor"
          ? "mentor"
          : p.status === "active" && p.member_tier === "paid"
            ? "subscriber"
            : "member"
    );
  }

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
        hires={((hires ?? []) as HireRow[]).map((h) => ({
          ...h,
          membership: h.profile_id ? (membershipOf.get(h.profile_id) ?? "member") : "outside",
        }))}
        clients={(clientRows ?? []).map((c) => ({ id: c.id, name: c.company_name }))}
        defaultDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
