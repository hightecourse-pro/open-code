"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { searchMembersForShare, type MemberHit } from "./actions";

/*
  A searchable member picker for the manual share (the owner, 21/10: "בבחירת
  המשתתפת אין השלמה אוטומטית ויש רק חלק מהבנות"). The old <select> listed the
  first 300 names alphabetically out of ~1,200 - so most members were simply
  missing. This one asks the server as she types (name or email, any status)
  and carries the chosen id in a hidden input for the existing form action.
*/
const STATUS: Record<string, string> = { active: "פעילה", pending: "ממתינה", paused: "מושהית", rejected: "נדחתה", left: "עזבה" };

export function MemberPicker({ name = "profile_id" }: { name?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<MemberHit | null>(null);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Debounced search; the latest answer wins.
  useEffect(() => {
    const needle = q.trim();
    if (picked || needle.length < 2) return; // (the render shows nothing below 2 chars - no setState here, the lint rule)
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await searchMembersForShare(needle);
        if (mine === seq.current) {
          setHits(res);
          setActive(0);
          setOpen(true);
        }
      } catch {
        if (mine === seq.current) setHits([]);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, picked]);

  // Click outside closes the list.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const visible = !picked && q.trim().length >= 2 ? hits : [];
  const choose = (m: MemberHit) => {
    setPicked(m);
    setQ(m.full_name);
    setOpen(false);
  };
  const clear = () => {
    setPicked(null);
    setQ("");
    setHits([]);
  };

  return (
    <div ref={boxRef} className="relative min-w-[260px]" data-testid="member-picker">
      <input type="hidden" name={name} value={picked?.id ?? ""} data-testid="member-picker-value" />
      <div className="flex items-center gap-1 border border-ink-300 rounded-md px-2.5 py-1.5 bg-white focus-within:border-brand-purple">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (picked) setPicked(null);
          }}
          onFocus={() => visible.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || visible.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(visible.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(visible[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="הקלידי שם או מייל של משתתפת…"
          className="flex-1 text-[13px] outline-none bg-transparent"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="member-picker-list"
          data-testid="member-picker-input"
        />
        {busy && <span className="text-[11px] text-ink-400">מחפשת…</span>}
        {picked && (
          <button type="button" onClick={clear} aria-label="ניקוי הבחירה" className="text-ink-400 hover:text-ink-700">
            <X size={14} />
          </button>
        )}
      </div>
      {picked && (
        <div className="mt-1 text-[12px] text-ink-500" data-testid="member-picker-chosen">
          נבחרה: <b className="text-ink-900">{picked.full_name}</b>
          {picked.email ? <span dir="ltr"> · {picked.email}</span> : null} · {STATUS[picked.status] ?? picked.status}
        </div>
      )}
      {open && !picked && (
        <ul
          role="listbox"
          id="member-picker-list"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto bg-white border border-ink-200 rounded-md shadow-lg text-[13px]"
          data-testid="member-picker-list"
        >
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-ink-500">{busy ? "מחפשת…" : "לא נמצאה משתתפת כזו."}</li>
          ) : (
            visible.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${i === active ? "bg-tint-purple/40" : ""}`}
                data-testid="member-picker-option"
              >
                <span className="font-medium text-ink-900">{m.full_name}</span>
                {m.email && (
                  <span className="text-ink-500 text-[12px]" dir="ltr">
                    {m.email}
                  </span>
                )}
                <span className="ms-auto text-[11px] rounded-full bg-ink-100 text-ink-600 px-2 py-0.5">{STATUS[m.status] ?? m.status}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
