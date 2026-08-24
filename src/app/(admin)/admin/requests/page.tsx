import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Badge, Button, Textarea } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { replyToMemberRequest } from "../actions";

export const metadata: Metadata = { title: "בקשות מהחברות" };
export const dynamic = "force-dynamic";

/**
 * The inbox behind the members' floating "יש לך בקשה?" widget. Replying sends
 * the answer into HER CHAT and marks the request handled — one motion.
 */
export default async function AdminRequestsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("member_requests")
    .select("id, profile_id, subject, body, status, created_at, handled_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = [...new Set((requests ?? []).map((r) => r.profile_id))];
  const { data: members } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameOf = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const open = (requests ?? []).filter((r) => r.status === "open");
  const handled = (requests ?? []).filter((r) => r.status !== "open");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;בקשות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1 flex items-center gap-2">
          <Inbox size={24} className="text-brand-purple" /> בקשות מהחברות
        </h1>
        <p className="t-body-sm text-ink-500">
          הודעות מהכפתור הצף. תשובה נשלחת אליה ישירות בצ&apos;אט ומסמנת את הבקשה כטופלה.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">ממתינות ({open.length})</h3>
        {open.length > 0 ? (
          <div className="flex flex-col gap-4">
            {open.map((r) => (
              <div key={r.id} className="border border-ink-200 rounded-md p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Link
                    href={`/admin/members/${r.profile_id}`}
                    className="font-semibold text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {nameOf.get(r.profile_id) ?? "חברת קהילה"}
                  </Link>
                  <Badge variant="purple">{r.subject}</Badge>
                  <span className="text-[11.5px] text-ink-500">{timeAgo(r.created_at)}</span>
                </div>
                <p className="text-[13.5px] text-ink-700 whitespace-pre-wrap">{r.body}</p>
                <form action={replyToMemberRequest.bind(null, r.id)} className="flex flex-col gap-2">
                  <Textarea
                    name="reply"
                    rows={2}
                    placeholder="התשובה שלך — תישלח אליה בצ'אט…"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      שליחת תשובה בצ&apos;אט + סימון טופל
                    </Button>
                  </div>
                </form>
                <form action={replyToMemberRequest.bind(null, r.id)}>
                  <button
                    type="submit"
                    className="text-[12px] text-ink-500 hover:text-ink-900 underline"
                  >
                    סימון כטופל בלי תשובה
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">אין בקשות פתוחות כרגע 💜</p>
        )}
      </div>

      {handled.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-3">טופלו ({handled.length})</h3>
          <div className="flex flex-col">
            {handled.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 py-2 border-b border-ink-100 last:border-b-0 flex-wrap opacity-70">
                <span className="font-medium text-ink-900">{nameOf.get(r.profile_id) ?? "חברה"}</span>
                <span className="text-[13px] text-ink-700 flex-1 truncate">{r.subject}</span>
                <span className="text-[11.5px] text-ink-500">
                  טופל {r.handled_at ? timeAgo(r.handled_at) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
