"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { setMemberRoleAction } from "@/app/(admin)/admin/actions";

/**
 * Appointing a member as a mentor, compactly: type her name, appoint in one
 * click. Replaces the 50-row button wall (the owner, 10/9: "לא נח ותופס
 * מידי הרבה מקום").
 */
export function AppointMentorPicker({
  candidates,
}: {
  candidates: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [appointed, setAppointed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const needle = q.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 8)
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 end-3 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש חברה פעילה לפי שם…"
          className="w-full text-[13px] border border-ink-200 rounded-md px-3 py-2 pe-9 outline-none focus:border-brand-purple bg-white"
        />
      </div>
      {!needle && (
        <p className="text-[12px] text-ink-400">הקלידי שם — המינוי בלחיצה אחת ליד ההתאמה.</p>
      )}
      {needle && matches.length === 0 && (
        <p className="text-[12.5px] text-ink-500">לא נמצאה חברה פעילה בשם הזה.</p>
      )}
      {matches.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-3 py-1.5 border-b border-ink-100 last:border-b-0 text-[13px]"
        >
          <span className="font-medium text-ink-900 truncate">{c.name}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`למנות את ${c.name} כמנטורית? 👑`)) return;
              start(() =>
                Promise.resolve(setMemberRoleAction(c.id, "mentor")).then(() => setAppointed(c.name))
              );
            }}
            className="shrink-0 text-[12.5px] font-semibold text-brand-purple hover:underline cursor-pointer disabled:opacity-50"
          >
            {pending ? "ממנה…" : "מינוי כמנטורית 👑"}
          </button>
        </div>
      ))}
      {appointed && !pending && (
        <p className="text-[12.5px] font-semibold text-success">{appointed} מונתה כמנטורית ✓</p>
      )}
    </div>
  );
}
