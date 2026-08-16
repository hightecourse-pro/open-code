import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { resolveReportsForTarget } from "./actions";
import type { ReportTarget } from "@/types/database";

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

  // One card per reported ITEM, not per report row: three members reporting
  // the same post is one decision for the admin, not three identical cards.
  type Row = NonNullable<typeof reports>[number];
  const groups = new Map<string, { targetType: ReportTarget; targetId: string; rows: Row[] }>();
  for (const r of reports ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key) ?? { targetType: r.target_type, targetId: r.target_id, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  // rows[0] is the newest (the query is sorted), so it decides the card's badge.
  const cards = [...groups.entries()].map(([key, g]) => {
    const openRows = g.rows.filter((r) => r.status === "open");
    return { key, ...g, openRows, isOpen: openRows.length > 0 };
  });
  const openCards = cards.filter((c) => c.isOpen);
  const handledCards = cards.filter((c) => !c.isOpen);

  /** One reported item, open or already handled — the markup is the same. */
  function reportCard(card: (typeof cards)[number]) {
    const newest = card.rows[0];
    const st = STATUS[card.isOpen ? "open" : newest.status] ?? STATUS.open;
    const post = card.targetType === "post" ? postMap.get(card.targetId) : undefined;
    const comment = card.targetType === "comment" ? commentMap.get(card.targetId) : undefined;
    const target = post ?? comment;
    const where = post ? (post.kind === "forum" ? "פורום" : "פיד") : comment ? "תגובה" : null;
    const whereHref = post?.kind === "feed" ? "/feed" : "/forum";
    // Any open row can carry the decision — it closes all of its siblings.
    const leadId = (card.openRows[0] ?? newest).id;

    return (
      <div key={card.key} className="flex flex-col gap-1.5 py-3.5 border-b border-ink-100 last:border-b-0">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={card.targetType === "post" ? "pink" : "purple"}>
            {card.targetType === "post" ? "פוסט" : "תגובה"}
          </Badge>
          {where && (
            <Link
              href={whereHref}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline"
            >
              ב{where} <ExternalLink size={11} />
            </Link>
          )}
          {card.rows.length > 1 && <Badge variant="warm">{card.rows.length} דיווחים</Badge>}
          <div className="flex-1 min-w-0" />
          <span className="text-[11px] text-ink-500">{timeAgo(newest.created_at)}</span>
          <Badge variant={st.variant}>{st.label}</Badge>
          {card.isOpen && (
            <div className="flex gap-1.5">
              <ConfirmActionButton
                action={resolveReportsForTarget.bind(
                  null,
                  leadId,
                  card.targetType,
                  card.targetId,
                  "reviewed"
                )}
                message={
                  card.rows.length > 1
                    ? `לסמן כטופל? התוכן המדווח יוסר מהקהילה לצמיתות, וכל ${card.rows.length} הדיווחים עליו ייסגרו.`
                    : "לסמן כטופל? התוכן המדווח יוסר מהקהילה לצמיתות."
                }
                title="טופל — הסרת התוכן"
                className="font-display font-semibold text-[13px] px-3.5 py-1.5 rounded-md bg-brand-gradient text-white"
              >
                טופל · הסרת התוכן
              </ConfirmActionButton>
              <form
                action={resolveReportsForTarget.bind(
                  null,
                  leadId,
                  card.targetType,
                  card.targetId,
                  "dismissed"
                )}
              >
                <Button type="submit" variant="ghost" size="sm">דחיית הדיווח</Button>
              </form>
            </div>
          )}
        </div>

        {/* Every reason stays visible — the same post can be reported for
            different things, and the decision covers all of them. */}
        <ul className="flex flex-col gap-0.5">
          {card.rows.map((r) => (
            <li key={r.id} className="text-ink-900 text-sm">
              <span className="text-ink-500">סיבת הדיווח: </span>
              {r.reason || "ללא פירוט"}
              <span className="text-[11px] text-ink-400"> · {timeAgo(r.created_at)}</span>
            </li>
          ))}
        </ul>

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
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מודרציה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מודרציה</h1>
        <p className="t-body-sm text-ink-700">
          דיווחים על תוכן בקהילה, כרטיס אחד לכל תוכן שדווח. ״טופל״ מסיר את התוכן; ״דחייה״ משאירה
          אותו — ובשני המקרים כל הדיווחים על אותו תוכן נסגרים יחד.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">דיווחים פתוחים ({openCards.length})</h3>
        {openCards.length > 0 ? (
          <div className="flex flex-col">
            {openCards.map((c) => reportCard(c))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-4">
            {cards.length > 0
              ? "אין דיווחים שמחכים לך — הכול טופל 💜"
              : "עדיין אין דיווחים — הקהילה נקייה 💜"}
          </p>
        )}
      </div>

      {handledCards.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-1">טופלו ({handledCards.length})</h3>
          <div className="flex flex-col">
            {handledCards.map((c) => reportCard(c))}
          </div>
        </div>
      )}
    </div>
  );
}
