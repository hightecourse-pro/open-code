import type { Metadata } from "next";
import { Share2, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button } from "@/components/ui";
import { markShareStatus, dismissShare } from "../content/actions";

export const metadata: Metadata = { title: "תור שיתופים" };

export default async function AdminSharesPage() {
  const supabase = await createClient();

  // Action-needed shares: pending (share it) or revoked (un-share it).
  const { data: shares } = await supabase
    .from("content_shares")
    .select("id, owner_type, owner_id, profile_id, status, created_at")
    .neq("status", "shared")
    .order("created_at", { ascending: true });

  const profileIds = [...new Set((shares ?? []).map((s) => s.profile_id))];
  const courseIds = [...new Set((shares ?? []).filter((s) => s.owner_type === "course").map((s) => s.owner_id))];
  const sessionIds = [...new Set((shares ?? []).filter((s) => s.owner_type === "session").map((s) => s.owner_id))];

  const [{ data: profiles }, { data: courses }, { data: sessions }] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] }),
    courseIds.length ? supabase.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] }),
    sessionIds.length
      ? supabase.from("sessions").select("id, title").in("id", sessionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const titleOf = new Map<string, string>([
    ...(courses ?? []).map((c) => [`course:${c.id}`, c.title] as [string, string]),
    ...(sessions ?? []).map((s) => [`session:${s.id}`, s.title] as [string, string]),
  ]);

  const pending = (shares ?? []).filter((s) => s.status === "pending");
  const revoked = (shares ?? []).filter((s) => s.status === "revoked");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;שיתופים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">תור שיתופים אישיים</h1>
        <p className="t-body-sm text-ink-500">
          כאן רואים למי צריך לשתף (או לבטל) קישורי Google Drive באופן אישי. השיתוף עצמו מתבצע בדרייב — כאן מסמנים שבוצע.
        </p>
      </div>

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
          <Share2 size={16} className="text-brand-pink-deep" /> לשתף ({pending.length})
        </h3>
        {pending.length > 0 ? (
          <div className="flex flex-col">
            {pending.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
                <UserCheck size={16} className="text-brand-purple" />
                <span className="font-medium text-ink-900">{nameOf.get(s.profile_id) ?? "—"}</span>
                <Badge variant={s.owner_type === "course" ? "pink" : "purple"}>
                  {s.owner_type === "course" ? "קורס" : "סשן"}
                </Badge>
                <span className="text-ink-700 text-sm">{titleOf.get(`${s.owner_type}:${s.owner_id}`) ?? "—"}</span>
                <form action={markShareStatus.bind(null, s.id, "shared")} className="ms-auto">
                  <Button type="submit" size="sm">סימון כשותף ✓</Button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">אין שיתופים ממתינים 💜</p>
        )}
      </section>

      {revoked.length > 0 && (
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-3">לבטל שיתוף ({revoked.length})</h3>
          <div className="flex flex-col">
            {revoked.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
                <span className="font-medium text-ink-900">{nameOf.get(s.profile_id) ?? "—"}</span>
                <Badge variant={s.owner_type === "course" ? "pink" : "purple"}>
                  {s.owner_type === "course" ? "קורס" : "סשן"}
                </Badge>
                <span className="text-ink-700 text-sm">{titleOf.get(`${s.owner_type}:${s.owner_id}`) ?? "—"}</span>
                <form action={dismissShare.bind(null, s.id)} className="ms-auto">
                  <Button type="submit" variant="ghost" size="sm">סימון כבוטל</Button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
