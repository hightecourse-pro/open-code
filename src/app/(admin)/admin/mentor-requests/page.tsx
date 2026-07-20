import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { setMentorRequestStatus } from "../actions";

export const metadata: Metadata = { title: "בקשות למנטורית" };

export default async function AdminMentorRequestsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("mentor_requests")
    .select("id, profile_id, reason, note, status, created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const ids = [...new Set((requests ?? []).map((r) => r.profile_id))];
  const { data: members } = ids.length
    ? await supabase.from("profiles").select("id, full_name, specialization").in("id", ids)
    : { data: [] };
  const memberOf = new Map((members ?? []).map((m) => [m.id, m]));

  const open = (requests ?? []).filter((r) => r.status === "open");
  const handled = (requests ?? []).filter((r) => r.status !== "open");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בקשות למנטורית</h1>
        <p className="t-body-sm text-ink-500">
          חברות שביקשו שנחבר אותן למנטורית. אחרי שחיברת — סמני כטופל.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">
          ממתינות לטיפול ({open.length})
        </h3>
        {open.length > 0 ? (
          <div className="flex flex-col">
            {open.map((r) => {
              const m = memberOf.get(r.profile_id);
              return (
                <div key={r.id} className="flex flex-col gap-1.5 py-3.5 border-b border-ink-100 last:border-b-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/admin/members/${r.profile_id}`}
                      className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                    >
                      {m?.full_name ?? "חברת קהילה"}
                    </Link>
                    {m?.specialization && <Badge variant="tech">{m.specialization}</Badge>}
                    <Badge variant="pink">{mentorReasonLabel(r.reason)}</Badge>
                    <span className="text-[11px] text-ink-500">{timeAgo(r.created_at)}</span>
                    <div className="ms-auto flex gap-1.5">
                      <form action={setMentorRequestStatus.bind(null, r.id, "handled")}>
                        <Button type="submit" size="sm">סימון כטופל</Button>
                      </form>
                    </div>
                  </div>
                  {r.note && (
                    <div className="bg-ink-50 border border-ink-100 rounded-md px-3 py-2 text-[13px] text-ink-700">
                      {r.note}
                    </div>
                  )}
                  <Link
                    href={`/chat`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-purple hover:underline w-fit"
                  >
                    <MessageCircle size={13} /> לצ&apos;אטים
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">אין בקשות פתוחות כרגע 💜</p>
        )}
      </div>

      {handled.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-3">טופלו ({handled.length})</h3>
          <div className="flex flex-col">
            {handled.map((r) => {
              const m = memberOf.get(r.profile_id);
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap opacity-70">
                  <Link
                    href={`/admin/members/${r.profile_id}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {m?.full_name ?? "חברת קהילה"}
                  </Link>
                  <Badge variant="tech">{mentorReasonLabel(r.reason)}</Badge>
                  <span className="text-[11px] text-ink-500">{timeAgo(r.created_at)}</span>
                  <form action={setMentorRequestStatus.bind(null, r.id, "open")} className="ms-auto">
                    <Button type="submit" size="sm" variant="ghost">החזרה לטיפול</Button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
