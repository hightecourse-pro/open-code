"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Pencil, Search } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  addExternalHire,
  deleteHire,
  setHireAmount,
  setHireInstitution,
  setHirePayer,
  setHireStatus,
  updateHireDetails,
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
  /** Live community standing, resolved server-side on entry (the owner, 3/9). */
  membership?: string;
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

// Who she is in the community — detected live at page entry.
const MEMBERSHIP_HE: Record<string, { label: string; cls: string }> = {
  subscriber: { label: "מנויה 💜", cls: "bg-tint-pink text-brand-pink-deep" },
  member: { label: "משתתפת רגילה", cls: "bg-tint-purple text-brand-purple" },
  mentor: { label: "מנטורית 👑", cls: "bg-tint-warm text-[#8C5E0E]" },
  team: { label: "צוות", cls: "bg-ink-900 text-white" },
  outside: { label: "מחוץ לקהילה", cls: "bg-ink-100 text-ink-700" },
};

type SortKey = "hired_at" | "full_name" | "amount" | "status";

export function HiresTable({ hires, defaultDate }: { hires: HireRow[]; defaultDate: string }) {
  const [addState, add, adding] = useActionState<HireFormState, FormData>(addExternalHire, {});
  const [showAdd, setShowAdd] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
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
        (memberFilter === "all" ||
          (memberFilter === "community"
            ? h.membership !== "outside"
            : memberFilter === "subscriber"
              ? h.membership === "subscriber"
              : h.membership === "outside")) &&
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
  }, [hires, statusFilter, payerFilter, memberFilter, q, sortKey, sortAsc]);

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
            className="h-9 w-52 border border-ink-300 rounded-md ps-8 pe-3 text-sm bg-white"
          />
        </div>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="h-9 border border-ink-300 rounded-md px-2 text-sm bg-white"
        >
          <option value="all">שיוך — הכל</option>
          <option value="subscriber">מנויות</option>
          <option value="community">בקהילה (כולן)</option>
          <option value="outside">מחוץ לקהילה</option>
        </select>
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
          value={`${sortKey}:${sortAsc ? "a" : "d"}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(":");
            setSortKey(k as SortKey);
            setSortAsc(d === "a");
          }}
          className="h-9 border border-ink-300 rounded-md px-2 text-sm bg-white"
        >
          <option value="hired_at:d">מיון: חדש → ישן</option>
          <option value="hired_at:a">מיון: ישן → חדש</option>
          <option value="full_name:a">מיון: לפי שם</option>
          <option value="amount:d">מיון: סכום גבוה → נמוך</option>
          <option value="status:a">מיון: לפי סטטוס</option>
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

      {/* Stacked rows — everything visible, nothing scrolls sideways
          (the owner, 3/9: "גורם גלילה משמאל לימין"). */}
      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm divide-y divide-ink-100">
        {filtered.map((h) => (
          <HireLine key={h.id} h={h} />
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-ink-500 text-[13px]">
            אין גיוסים שמתאימים לסינון.
          </div>
        )}
      </div>
    </div>
  );
}

function HireLine({ h }: { h: HireRow }) {
  const [, start] = useTransition();
  const [amount, setAmount] = useState(h.amount != null ? String(h.amount) : "");
  const [payer, setPayer] = useState(h.payer ?? "");
  const [institution, setInstitution] = useState(h.payer_institution ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    full_name: h.full_name,
    email: h.email ?? "",
    company: h.company ?? "",
    job_type: h.job_type ?? "",
    hired_at: h.hired_at.slice(0, 10),
  });
  const membership = MEMBERSHIP_HE[h.membership ?? "outside"] ?? MEMBERSHIP_HE.outside;

  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      {/* Line 1: who + where + when + actions */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {h.profile_id ? (
          <a
            href={`/admin/members/${h.profile_id}`}
            className="font-semibold text-[14px] text-ink-900 hover:text-brand-purple hover:underline"
          >
            {h.full_name}
          </a>
        ) : (
          <span className="font-semibold text-[14px] text-ink-900">{h.full_name}</span>
        )}
        <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", membership.cls)}>
          {membership.label}
        </span>
        {h.company && <span className="text-[12.5px] text-ink-700">{h.company}</span>}
        {h.job_type && JOB_TYPE_HE[h.job_type] && (
          <span className="text-[11px] text-ink-500">{JOB_TYPE_HE[h.job_type]}</span>
        )}
        <span className="text-[12px] text-ink-400 whitespace-nowrap">
          {new Date(h.hired_at).toLocaleDateString("he-IL")}
        </span>
        <span className="ms-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-purple hover:underline"
          >
            <Pencil size={11} /> עריכה
          </button>
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
        </span>
      </div>

      {/* Line 2: the billing trail */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
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
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => start(() => void setHireAmount(h.id, amount))}
          placeholder="סכום ₪"
          inputMode="decimal"
          className="h-8 w-24 border border-ink-200 rounded-md px-2 text-[13px] bg-white"
          dir="ltr"
        />
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
          <option value="">מי משלמת? — טרם נקבע</option>
          <option value="institution">מוסד הלימודים</option>
          <option value="member">המשתתפת</option>
        </select>
        {payer === "institution" && (
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            onBlur={() => start(() => void setHireInstitution(h.id, institution))}
            placeholder={h.profile_id ? "נמשך מהפרופיל…" : "שם המוסד"}
            className="h-8 w-40 border border-ink-200 rounded-md px-2 text-[12px] bg-white"
          />
        )}
      </div>

      {/* Line 3: the full editor, on demand */}
      {editing && (
        <div className="flex items-end gap-2 flex-wrap bg-ink-50/60 border border-ink-100 rounded-md p-3">
          <Field label="שם מלא" htmlFor={`en_${h.id}`} className="w-44 max-w-full">
            <Input
              id={`en_${h.id}`}
              value={draft.full_name}
              onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
            />
          </Field>
          <Field label="מייל" htmlFor={`ee_${h.id}`} className="w-52 max-w-full">
            <Input
              id={`ee_${h.id}`}
              dir="ltr"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
          </Field>
          <Field label="חברה" htmlFor={`ec_${h.id}`} className="w-40 max-w-full">
            <Input
              id={`ec_${h.id}`}
              value={draft.company}
              onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
            />
          </Field>
          <Field label="סוג משרה" htmlFor={`et_${h.id}`} className="w-44 max-w-full">
            <select
              id={`et_${h.id}`}
              value={draft.job_type}
              onChange={(e) => setDraft((d) => ({ ...d, job_type: e.target.value }))}
              className="w-full h-10 border border-ink-300 rounded-md px-2.5 text-sm bg-white"
            >
              <option value="">— לא צוין —</option>
              <option value="practicum_placement">פרקטיקום ולאחריו השמה</option>
              <option value="temp">משרה זמנית</option>
              <option value="immediate">השמה מיידית</option>
            </select>
          </Field>
          <Field label="מתי התחילה" htmlFor={`ed_${h.id}`} className="w-36 max-w-full">
            <Input
              id={`ed_${h.id}`}
              type="date"
              value={draft.hired_at}
              onChange={(e) => setDraft((d) => ({ ...d, hired_at: e.target.value }))}
            />
          </Field>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              start(async () => {
                const r = await updateHireDetails(h.id, draft);
                if (!r.error) setEditing(false);
                else alert(r.error);
              })
            }
          >
            שמירה
          </Button>
        </div>
      )}
    </div>
  );
}
