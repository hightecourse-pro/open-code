"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  addExternalHire,
  deleteHire,
  setHireAmount,
  setHireInstitution,
  setHirePayer,
  setHireStatus,
  type HireFormState,
} from "./hires-actions";

export interface HireRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  company: string | null;
  job_type: string | null;
  source: string;
  status: string;
  amount: number | null;
  payer: string | null;
  payer_institution: string | null;
  hired_at: string;
  created_at: string;
}

const JOB_TYPE_HE: Record<string, string> = {
  practicum_placement: "פרקטיקום ולאחריו השמה",
  temp: "משרה זמנית",
  immediate: "השמה מיידית",
};

const STATUS_HE: Record<string, string> = {
  started: "התחילה עבודה",
  invoice_sent: "נשלח חשבונית",
  paid: "שולם",
};
const STATUS_ORDER = ["started", "invoice_sent", "paid"];
const STATUS_CLS: Record<string, string> = {
  started: "bg-tint-purple text-brand-purple",
  invoice_sent: "bg-tint-warm text-[#8C5E0E]",
  paid: "bg-tint-mint text-success",
};

type SortKey = "hired_at" | "full_name" | "amount" | "status";

export function HiresTable({ hires, defaultDate }: { hires: HireRow[]; defaultDate: string }) {
  const [addState, add, adding] = useActionState<HireFormState, FormData>(addExternalHire, {});
  const [showAdd, setShowAdd] = useState(false);
  const [, start] = useTransition();

  // Fixed filters (the owner, 3/9: "סינונים, מיונים ופילטרים קבועים").
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("hired_at");
  const [sortAsc, setSortAsc] = useState(false);

  const counts = useMemo(() => {
    const by: Record<string, number> = { all: hires.length };
    for (const s of STATUS_ORDER) by[s] = hires.filter((h) => h.status === s).length;
    return by;
  }, [hires]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    const rows = hires.filter(
      (h) =>
        (statusFilter === "all" || h.status === statusFilter) &&
        (payerFilter === "all" || (payerFilter === "none" ? !h.payer : h.payer === payerFilter)) &&
        (sourceFilter === "all" || h.source === sourceFilter) &&
        (!needle ||
          h.full_name.includes(needle) ||
          (h.company ?? "").includes(needle) ||
          (h.email ?? "").includes(needle) ||
          (h.payer_institution ?? "").includes(needle))
    );
    const dir = sortAsc ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === "full_name") return a.full_name.localeCompare(b.full_name, "he") * dir;
      if (sortKey === "amount") return ((a.amount ?? -1) - (b.amount ?? -1)) * dir;
      if (sortKey === "status")
        return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir;
      return (new Date(a.hired_at).getTime() - new Date(b.hired_at).getTime()) * dir;
    });
    return rows;
  }, [hires, statusFilter, payerFilter, sourceFilter, q, sortKey, sortAsc]);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "full_name");
    }
  }

  const Th = ({ label, k }: { label: string; k?: SortKey }) => (
    <th
      className={cn(
        "text-start text-[11.5px] font-bold text-ink-500 px-3 py-2 whitespace-nowrap",
        k && "cursor-pointer hover:text-brand-purple select-none"
      )}
      onClick={k ? () => sortBy(k) : undefined}
    >
      {label}
      {k && sortKey === k && <span className="ms-0.5">{sortAsc ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Status chips with live counts */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", ...STATUS_ORDER].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors",
              statusFilter === s
                ? "bg-brand-gradient text-white border-transparent"
                : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
            )}
          >
            {s === "all" ? "הכל" : STATUS_HE[s]} · {counts[s] ?? 0}
          </button>
        ))}
        <span className="ms-auto text-[12.5px] text-ink-500">
          מוצגות {filtered.length} מתוך {hires.length}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש שם / חברה / מוסד…"
            className="h-9 w-56 border border-ink-300 rounded-md ps-8 pe-3 text-sm bg-white"
          />
        </div>
        <select
          value={payerFilter}
          onChange={(e) => setPayerFilter(e.target.value)}
          className="h-9 border border-ink-300 rounded-md px-2 text-sm bg-white"
        >
          <option value="all">מי משלמת — הכל</option>
          <option value="institution">מוסד הלימודים</option>
          <option value="member">המשתתפת</option>
          <option value="none">טרם נקבע</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-9 border border-ink-300 rounded-md px-2 text-sm bg-white"
        >
          <option value="all">מקור — הכל</option>
          <option value="community">חברות קהילה</option>
          <option value="external">מחוץ לקהילה</option>
        </select>
        <Button type="button" size="sm" variant={showAdd ? "secondary" : "primary"} onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "סגירה" : "+ הוספה מחוץ לקהילה"}
        </Button>
      </div>

      {showAdd && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-500">
            השמה של מישהי שאינה חברת קהילה — לרישום ולבאנר החגיגי (60 יום מהתאריך).
          </p>
          {addState.error && <Alert variant="danger">{addState.error}</Alert>}
          {addState.ok && <Alert variant="success">נוספה 🎉</Alert>}
          <form action={add} className="flex items-end gap-2 flex-wrap">
            <Field label="שם מלא" htmlFor="eh_name" className="w-48 max-w-full">
              <Input id="eh_name" name="full_name" required placeholder="שם מלא" />
            </Field>
            <Field label="מייל" htmlFor="eh_email" className="w-52 max-w-full">
              <Input id="eh_email" name="email" type="email" dir="ltr" placeholder="email@example.com" />
            </Field>
            <Field label="חברה" htmlFor="eh_company" className="w-44 max-w-full">
              <Input id="eh_company" name="company" placeholder="שם החברה" />
            </Field>
            <Field label="סוג משרה" htmlFor="eh_type" className="w-48 max-w-full">
              <select
                id="eh_type"
                name="job_type"
                className="w-full h-10 border border-ink-300 rounded-md px-2.5 text-sm bg-white"
                defaultValue=""
              >
                <option value="">— לא צוין —</option>
                <option value="practicum_placement">פרקטיקום ולאחריו השמה</option>
                <option value="temp">משרה זמנית</option>
                <option value="immediate">השמה מיידית</option>
              </select>
            </Field>
            <Field label="מתי התחילה" htmlFor="eh_date" className="w-40 max-w-full">
              <Input id="eh_date" name="hired_at" type="date" defaultValue={defaultDate} />
            </Field>
            <Button type="submit" size="sm" disabled={adding}>
              {adding ? "מוסיפות…" : "הוספה"}
            </Button>
          </form>
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead className="border-b border-ink-100">
            <tr>
              <Th label="שם" k="full_name" />
              <Th label="חברה" />
              <Th label="סוג משרה" />
              <Th label="מקור" />
              <Th label="תאריך" k="hired_at" />
              <Th label="סטטוס" k="status" />
              <Th label="סכום" k="amount" />
              <Th label="מי משלמת" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <HireLine key={h.id} h={h} start={start} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-ink-500 text-[13px]">
                  אין גיוסים שמתאימים לסינון.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HireLine({ h, start }: { h: HireRow; start: (fn: () => void) => void }) {
  const [amount, setAmount] = useState(h.amount != null ? String(h.amount) : "");
  const [payer, setPayer] = useState(h.payer ?? "");
  const [institution, setInstitution] = useState(h.payer_institution ?? "");

  return (
    <tr className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50 align-middle">
      <td className="px-3 py-2 whitespace-nowrap">
        {h.profile_id ? (
          <a
            href={`/admin/members/${h.profile_id}`}
            className="font-semibold text-ink-900 hover:text-brand-purple hover:underline"
          >
            {h.full_name}
          </a>
        ) : (
          <span className="font-semibold text-ink-900">{h.full_name}</span>
        )}
        {h.email && (
          <div className="font-mono text-[10.5px] text-ink-400" dir="ltr">
            {h.email}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-[13px] text-ink-700">{h.company ?? "—"}</td>
      <td className="px-3 py-2 text-[12px] text-ink-700 whitespace-nowrap">
        {h.job_type ? (JOB_TYPE_HE[h.job_type] ?? h.job_type) : "—"}
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
            h.source === "community" ? "bg-tint-purple text-brand-purple" : "bg-ink-100 text-ink-700"
          )}
        >
          {h.source === "community" ? "בקהילה" : "מחוץ לקהילה"}
        </span>
      </td>
      <td className="px-3 py-2 text-[12.5px] text-ink-500 whitespace-nowrap">
        {new Date(h.hired_at).toLocaleDateString("he-IL")}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              title={STATUS_HE[s]}
              onClick={() => start(() => void setHireStatus(h.id, s))}
              className={cn(
                "text-[10.5px] font-bold px-2 py-1 rounded-full whitespace-nowrap transition-all",
                h.status === s ? STATUS_CLS[s] : "bg-white border border-ink-200 text-ink-400 hover:border-brand-purple"
              )}
            >
              {STATUS_HE[s]}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => start(() => void setHireAmount(h.id, amount))}
          placeholder="₪"
          inputMode="decimal"
          className="h-8 w-24 border border-ink-200 rounded-md px-2 text-[13px] bg-white text-start"
          dir="ltr"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <select
            value={payer}
            onChange={(e) => {
              const v = e.target.value;
              setPayer(v);
              start(async () => {
                const r = await setHirePayer(h.id, v);
                if (v === "institution") setInstitution(r.institution ?? "");
              });
            }}
            className="h-8 border border-ink-200 rounded-md px-1.5 text-[12px] bg-white"
          >
            <option value="">— טרם נקבע —</option>
            <option value="institution">מוסד הלימודים</option>
            <option value="member">המשתתפת</option>
          </select>
          {payer === "institution" && (
            <input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              onBlur={() => start(() => void setHireInstitution(h.id, institution))}
              placeholder={h.profile_id ? "נמשך מהפרופיל…" : "שם המוסד"}
              className="h-7 w-36 border border-ink-200 rounded-md px-2 text-[11.5px] bg-white"
            />
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-end">
        <button
          type="button"
          onClick={() => {
            if (confirm(`להסיר את הגיוס של ${h.full_name}? הרישום יימחק לגמרי.`))
              start(() => void deleteHire(h.id));
          }}
          className="text-[11.5px] text-ink-400 hover:text-danger underline"
        >
          הסרה
        </button>
      </td>
    </tr>
  );
}
