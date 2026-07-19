import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { updateReportStatus } from "../actions";

export const metadata: Metadata = { title: "מודרציה" };

const STATUS: Record<string, { label: string; variant: "warm" | "mint" | "tech" }> = {
  open: { label: "פתוח", variant: "warm" },
  reviewed: { label: "טופל", variant: "mint" },
  dismissed: { label: "נדחה", variant: "tech" },
};

export default async function AdminModerationPage() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, status, created_at")
    .order("created_at", { ascending: false });

  // Pull the reported content so it's clear WHAT was reported and WHERE.
  const postIds = (reports ?? []).filter((r) => r.target_type === "post").map((r) => r.target_id);
  const commentIds = (reports ?? [])
    .filter((r) => r.target_type === "comment")
    .map((r) => r.target_id);

  const [{ data: posts }, { data: comments }] = await Promise.all([
    postIds.length
      ? supabase.from("posts").select("id, body, kind, author_id").in("id", postIds)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase.from("comments").select("id, body, author_id").in("id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const authorIds = [
    ...new Set([
      ...(posts ?? []).map((p) => p.author_id),
      ...(comments ?? []).map((c) => c.author_id),
    ]),
  ];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const nameOf = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  const postMap = new Map((posts ?? []).map((p) => [p.id, p]));
  const commentMap = new Map((comments ?? []).map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מודרציה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מודרציה</h1>
        <p className="t-body-sm text-ink-700">
          דיווחים על תוכן בקהילה. ״טופל״ מסיר את התוכן המדווח; ״דחייה״ משאירה אותו.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        {reports && reports.length > 0 ? (
          <div className="flex flex-col">
            {reports.map((r) => {
              const st = STATUS[r.status] ?? STATUS.open;
              const post = r.target_type === "post" ? postMap.get(r.target_id) : undefined;
              const comment = r.target_type === "comment" ? commentMap.get(r.target_id) : undefined;
              const target = post ?? comment;
              const where = post ? (post.kind === "forum" ? "פורום" : "פיד") : comment ? "תגובה" : null;
              const whereHref = post?.kind === "feed" ? "/feed" : "/forum";
              return (
                <div key={r.id} className="flex flex-col gap-1.5 py-3.5 border-b border-ink-100 last:border-b-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={r.target_type === "post" ? "pink" : "purple"}>
                      {r.target_type === "post" ? "פוסט" : "תגובה"}
                    </Badge>
                    {where && (
                      <Link
                        href={whereHref}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline"
                      >
                        ב{where} <ExternalLink size={11} />
                      </Link>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-ink-900 text-sm truncate">
                        <span className="text-ink-500">סיבת הדיווח: </span>
                        {r.reason || "ללא פירוט"}
                      </div>
                    </div>
                    <span className="text-[11px] text-ink-500">{timeAgo(r.created_at)}</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {r.status === "open" && (
                      <div className="flex gap-1.5">
                        <ConfirmActionButton
                          action={updateReportStatus.bind(null, r.id, "reviewed")}
                          message="לסמן כטופל? התוכן המדווח יוסר מהקהילה לצמיתות."
                          title="טופל — הסרת התוכן"
                          className="font-display font-semibold text-[13px] px-3.5 py-1.5 rounded-md bg-brand-gradient text-white"
                        >
                          טופל · הסרת התוכן
                        </ConfirmActionButton>
                        <form action={updateReportStatus.bind(null, r.id, "dismissed")}>
                          <Button type="submit" variant="ghost" size="sm">דחייה</Button>
                        </form>
                      </div>
                    )}
                  </div>
                  {/* The reported content itself, so it can be judged at a glance. */}
                  <div className="bg-ink-50 border border-ink-100 rounded-md px-3 py-2 text-[13px] text-ink-700">
                    {target ? (
                      <>
                        <span className="font-semibold text-ink-900">
                          {nameOf.get(target.author_id) ?? "חברת קהילה"}:
                        </span>{" "}
                        {target.body.length > 220 ? `${target.body.slice(0, 220)}…` : target.body}
                      </>
                    ) : (
                      <span className="text-ink-400">(התוכן כבר הוסר)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-4">אין דיווחים פתוחים — הקהילה נקייה 💜</p>
        )}
      </div>
    </div>
  );
}
