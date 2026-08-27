"use client";

import { useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { Badge, Button, Checkbox } from "@/components/ui";
import { markSharesShared } from "../content/actions";

export interface PendingShareRow {
  id: string;
  memberName: string;
  ownerType: string;
  contentTitle: string;
  /** he-IL date — "מחכה מ-…". */
  since: string;
}

/**
 * The pending queue with the PM's bulk flow: check some (or all) and mark
 * them done in one click, and every row says since when it's been waiting.
 */
export function PendingShares({ rows }: { rows: PendingShareRow[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const allChecked = checked.size === rows.length && rows.length > 0;

  function mark(ids: string[]) {
    setChecked(new Set());
    start(() => void markSharesShared(ids));
  }

  if (rows.length === 0) return <p className="text-ink-500 text-sm">אין שיתופים ממתינים 💜</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Checkbox
          checked={allChecked}
          onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
          label={<span className="text-[12.5px] text-ink-700">בחירת הכול</span>}
        />
        {checked.size > 0 && (
          <Button size="sm" disabled={pending} onClick={() => mark([...checked])}>
            {pending ? "מסמנת…" : `סימון ${checked.size} כבוצעו ✓`}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => mark(rows.map((r) => r.id))}
          className="ms-auto"
        >
          סימון הכול כבוצע
        </Button>
      </div>
      <div className="flex flex-col">
        {rows.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
            <Checkbox
              checked={checked.has(s.id)}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  return next;
                })
              }
              label=""
            />
            <UserCheck size={16} className="text-brand-purple" />
            <span className="font-medium text-ink-900">{s.memberName}</span>
            <Badge variant={s.ownerType === "course" ? "pink" : "purple"}>
              {s.ownerType === "course" ? "קורס" : "סשן"}
            </Badge>
            <span className="text-ink-700 text-sm">{s.contentTitle}</span>
            <span className="text-[11.5px] text-ink-400 tabular-nums">מחכה מ-{s.since}</span>
            <Button size="sm" className="ms-auto" disabled={pending} onClick={() => mark([s.id])}>
              סימון כבוצע ✓
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
