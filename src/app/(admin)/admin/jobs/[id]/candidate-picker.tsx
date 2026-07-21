"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addJobCandidate, removeJobCandidate } from "@/app/(admin)/admin/actions";

export interface PickerMember {
  id: string;
  full_name: string;
  specialization: string | null;
}

const MAX_ROWS = 40;

/**
 * Searchable picker over every active member — add/remove a candidate onto the
 * job with one click. Optimistic locally; the server (revalidate) is the source
 * of truth on the next load.
 */
export function CandidatePicker({
  jobId,
  members,
  addedIds,
}: {
  jobId: string;
  members: PickerMember[];
  addedIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Set<string>>(() => new Set(addedIds));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? members.filter(
          (m) =>
            m.full_name.toLowerCase().includes(q) ||
            (m.specialization ?? "").toLowerCase().includes(q)
        )
      : members;
    return base.slice(0, MAX_ROWS);
  }, [members, query]);

  function apply(id: string, on: boolean) {
    setAdded((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggle(m: PickerMember, on: boolean) {
    setBusyId(m.id);
    apply(m.id, on); // optimistic
    startTransition(async () => {
      try {
        if (on) await addJobCandidate(jobId, m.id);
        else await removeJobCandidate(jobId, m.id);
      } catch {
        apply(m.id, !on); // the action failed — put the label back
      } finally {
        setBusyId((b) => (b === m.id ? null : b));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={15}
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400 pointer-events-none"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם או התמחות…"
          className="ps-9"
        />
      </div>

      <div className="flex flex-col max-h-[420px] overflow-y-auto">
        {results.map((m) => {
          const isAdded = added.has(m.id);
          const busy = busyId === m.id;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{m.full_name}</div>
                <div className="text-xs text-ink-500 truncate">{m.specialization ?? "—"}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(m, !isAdded)}
                title={isAdded ? "הסרה מהמשרה" : "הוספה למשרה"}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-md px-3 py-1.5 transition-[filter] disabled:opacity-50",
                  isAdded
                    ? "bg-tint-mint text-[#0F6E4A] border border-[#BFE4D1] hover:brightness-95"
                    : "bg-brand-gradient text-white hover:brightness-105"
                )}
              >
                {isAdded ? <Check size={13} /> : <Plus size={13} />}
                {isAdded ? "נוספה" : "הוספה"}
              </button>
            </div>
          );
        })}
        {results.length === 0 && (
          <p className="text-ink-500 text-sm py-3">לא נמצאו מועמדות מתאימות.</p>
        )}
      </div>

      {query.trim() === "" && members.length > MAX_ROWS && (
        <p className="text-[12px] text-ink-400">
          מוצגות {MAX_ROWS} הראשונות מתוך {members.length} — חפשי כדי לצמצם.
        </p>
      )}
    </div>
  );
}
