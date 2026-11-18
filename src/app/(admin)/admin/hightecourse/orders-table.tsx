"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, RefreshCw, Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PAYMENT_LABEL, STATUS_LABEL, nis, type OrderStatus, type PaymentMethod } from "@/lib/conference-shared";
import type { OrderRow, ParticipantRow } from "@/lib/conference";
import { deleteConferenceOrder, resyncConferenceSheet, updateConferenceOrder } from "./actions";

export interface AdminOrder extends OrderRow {
  participants: ParticipantRow[];
}

const STATUS_CLS: Record<string, string> = {
  pending: "bg-ink-100 text-ink-600",
  paid_reported: "bg-amber-100 text-amber-800",
  paid: "bg-tint-green text-green-800",
  awaiting_transfer: "bg-tint-purple text-brand-purple",
  canceled: "bg-ink-100 text-ink-500 line-through",
};

const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

function who(o: AdminOrder): string {
  const p = o.participants[0];
  return o.kind === "group" ? `${o.company ?? ""}` : `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
}

function csvOf(rows: AdminOrder[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["מספר הרשמה", "סוג", "ת.ז.", "שם פרטי", "שם משפחה", "מייל פרטי", "מייל עבודה", "נייד", "תפקיד", "משרד", "חברה", "אופן תשלום", "סטטוס", "הערה", "איש קשר", "מייל איש קשר", "חשבונית על שם", "ח.פ.", "תאריך רישום", "מחיר למשתתפת", "סכום ההרשמה", "אסמכתא נדרים", "הערת צוות"];
  const lines: string[] = [];
  for (const o of rows) {
    for (const p of o.participants) {
      lines.push(
        [
          o.short_code,
          o.kind === "group" ? "קבוצה" : "יחידה",
          p.national_id,
          p.first_name,
          p.last_name,
          p.personal_email,
          p.work_email ?? "",
          p.phone,
          p.role_title ?? "",
          p.department ?? "",
          o.kind === "group" ? (o.company ?? "") : (p.company ?? ""),
          PAYMENT_LABEL[o.payment_method as PaymentMethod] ?? o.payment_method,
          STATUS_LABEL[o.status as OrderStatus] ?? o.status,
          o.note ?? "",
          o.contact_name ?? "",
          o.contact_email ?? "",
          o.invoice_name ?? "",
          o.company_id ?? "",
          fmt.format(new Date(o.created_at)),
          o.unit_price_nis,
          o.amount_nis,
          o.nedarim_transaction_id ?? "",
          o.admin_note ?? "",
        ]
          .map(esc)
          .join(",")
      );
    }
  }
  return "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
}

type Filter = "all" | "paid" | "verify" | "transfer" | "pending" | "canceled" | "sheet";

export function OrdersTable({ rows: initial }: { rows: AdminOrder[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "paid" && r.status !== "paid") return false;
      if (filter === "verify" && r.status !== "paid_reported") return false;
      if (filter === "transfer" && r.status !== "awaiting_transfer") return false;
      if (filter === "pending" && r.status !== "pending") return false;
      if (filter === "canceled" && r.status !== "canceled") return false;
      if (filter === "sheet" && (r.sheet_synced_at || r.status === "pending" || r.status === "canceled")) return false;
      if (!needle) return true;
      const hay = [who(r), r.short_code, r.company ?? "", r.contact_name ?? "", r.contact_email ?? "", r.note ?? "", r.admin_note ?? "", ...r.participants.flatMap((p) => [p.first_name, p.last_name, p.personal_email, p.phone, p.national_id, p.role_title ?? "", p.department ?? ""])];
      return hay.some((s) => s.toLowerCase().includes(needle));
    });
  }, [rows, q, filter]);

  const counts = {
    all: rows.length,
    paid: rows.filter((r) => r.status === "paid").length,
    verify: rows.filter((r) => r.status === "paid_reported").length,
    transfer: rows.filter((r) => r.status === "awaiting_transfer").length,
    pending: rows.filter((r) => r.status === "pending").length,
    canceled: rows.filter((r) => r.status === "canceled").length,
    sheet: rows.filter((r) => !r.sheet_synced_at && r.status !== "pending" && r.status !== "canceled").length,
  };

  function patch(id: string, p: { status?: OrderStatus; adminNote?: string }) {
    setError(null);
    start(async () => {
      const r = await updateConferenceOrder(id, p);
      if (r.error) return setError(r.error);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                ...(p.status ? { status: p.status, paid_at: p.status === "paid" ? (row.paid_at ?? new Date().toISOString()) : null, sheet_synced_at: p.status === "paid" ? (row.sheet_synced_at ?? new Date().toISOString()) : row.sheet_synced_at } : {}),
                ...(p.adminNote !== undefined ? { admin_note: p.adminNote.trim() || null } : {}),
              }
            : row
        )
      );
    });
  }

  function resync(id: string) {
    setError(null);
    start(async () => {
      const r = await resyncConferenceSheet(id);
      if (r.error) return setError(`הכתיבה לגיליון נכשלה: ${r.error}`);
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, sheet_synced_at: new Date().toISOString(), sheet_error: null } : row)));
    });
  }

  function remove(row: AdminOrder) {
    if (!confirm(`למחוק את ההרשמה של ${who(row)} (${row.short_code})? השורות בגיליון נשארות - למחוק אותן ידנית. (לא ניתן לשחזר)`)) return;
    start(async () => {
      const r = await deleteConferenceOrder(row.id);
      if (r.error) return setError(r.error);
      setRows((prev) => prev.filter((x) => x.id !== row.id));
    });
  }

  function exportCsv() {
    const blob = new Blob([csvOf(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hightecourse-2026-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="hc-admin-table">
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            ["all", `הכל (${counts.all})`],
            ["paid", `שולם (${counts.paid})`],
            ["transfer", `העברה - ממתינה (${counts.transfer})`],
            ["verify", `לאימות (${counts.verify})`],
            ["pending", `אשראי לא שולם (${counts.pending})`],
            ["sheet", `לא בגיליון (${counts.sheet})`],
            ["canceled", `בוטל (${counts.canceled})`],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-semibold border transition-colors", filter === k ? "bg-ink-1000 text-white border-ink-1000" : "bg-white text-ink-700 border-ink-200 hover:border-ink-400")}
          >
            {label}
          </button>
        ))}
        <div className="ms-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-ink-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: שם, חברה, מייל, ת.ז., מספר הרשמה" className="ps-8 w-[300px] max-w-full" />
          </div>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!shown.length}>
            ייצוא CSV ({shown.reduce((n, r) => n + r.participants.length, 0)} שורות)
          </Button>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="rounded-[14px] border border-ink-100 bg-white overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-ink-50 text-ink-600 text-[12px]">
            <tr>
              <th className="text-start font-semibold px-3 py-2">נרשמה ב</th>
              <th className="text-start font-semibold px-3 py-2">מי</th>
              <th className="text-start font-semibold px-3 py-2">משתתפות</th>
              <th className="text-start font-semibold px-3 py-2">סכום</th>
              <th className="text-start font-semibold px-3 py-2">תשלום</th>
              <th className="text-start font-semibold px-3 py-2">סטטוס</th>
              <th className="text-start font-semibold px-3 py-2">גיליון</th>
              <th className="text-start font-semibold px-3 py-2">הערת צוות</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const isOpen = !!open[r.id];
              const p1 = r.participants[0];
              return (
                <RowGroup key={r.id}>
                  <tr className={cn("border-t border-ink-100 align-top", pending && "opacity-70")} data-testid={`hc-admin-row-${r.short_code}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">
                      {fmt.format(new Date(r.created_at))}
                      <div className="text-[11px] text-ink-400" dir="ltr">
                        {r.short_code}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <div className="font-semibold text-ink-900">{who(r)}</div>
                      <div className="text-[12px] text-ink-500" dir="ltr">
                        {r.kind === "group" ? r.contact_email : p1?.personal_email}
                      </div>
                      <div className="text-[12px] text-ink-500">
                        {r.kind === "group" ? `קבוצה · איש קשר ${r.contact_name ?? ""} · חשבונית ע״ש ${r.invoice_name ?? ""} · ח.פ. ${r.company_id ?? ""}` : `יחידה · ${p1?.phone ?? ""} · ${p1?.company ?? ""}`}
                      </div>
                      {r.note && <div className="text-[12px] text-ink-700 mt-0.5">הערה: {r.note}</div>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => setOpen((o) => ({ ...o, [r.id]: !isOpen }))} className="inline-flex items-center gap-1 font-semibold text-ink-900 hover:underline" data-testid={`hc-admin-toggle-${r.short_code}`}>
                        {r.participant_count}
                        <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold">{nis(r.amount_nis)} ₪</div>
                      <div className="text-[11.5px] text-ink-500">
                        {r.participant_count} × {nis(r.unit_price_nis)}
                      </div>
                      {r.payment_amount_agorot != null && r.payment_amount_agorot !== r.amount_nis * 100 && <div className="text-[11.5px] text-amber-700">נגבה {nis(r.payment_amount_agorot / 100)} ₪</div>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">
                      {PAYMENT_LABEL[r.payment_method as PaymentMethod]}
                      {r.nedarim_transaction_id && (
                        <div className="text-[11px] text-ink-400" dir="ltr">
                          {r.nedarim_transaction_id}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge className={STATUS_CLS[r.status] ?? ""}>{STATUS_LABEL[r.status as OrderStatus] ?? r.status}</Badge>
                      <select
                        className="block mt-1.5 rounded-md border border-ink-200 bg-white px-1.5 py-1 text-[12px]"
                        value={r.status}
                        onChange={(e) => patch(r.id, { status: e.target.value as OrderStatus })}
                        disabled={pending}
                        aria-label="שינוי סטטוס"
                        data-testid={`hc-admin-status-${r.short_code}`}
                      >
                        {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.sheet_synced_at ? (
                        <span className="text-green-800 font-semibold">✓ נכתב</span>
                      ) : r.status === "pending" || r.status === "canceled" ? (
                        <span className="text-ink-400">-</span>
                      ) : (
                        <div>
                          <span className="text-amber-800 font-semibold">לא נכתב</span>
                          {r.sheet_error && (
                            <div className="text-[11px] text-ink-500 max-w-[180px] whitespace-normal" dir="ltr">
                              {r.sheet_error.slice(0, 120)}
                            </div>
                          )}
                          <button type="button" onClick={() => resync(r.id)} disabled={pending} className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline" data-testid={`hc-admin-resync-${r.short_code}`}>
                            <RefreshCw size={12} />
                            לכתוב לגיליון שוב
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <NoteCell value={r.admin_note ?? ""} onSave={(v) => patch(r.id, { adminNote: v })} />
                    </td>
                    <td className="px-2 py-2.5">
                      <button type="button" onClick={() => remove(r)} className="text-ink-400 hover:text-danger" title="מחיקה" aria-label="מחיקה">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-ink-50/60" data-testid={`hc-admin-participants-${r.short_code}`}>
                      <td colSpan={9} className="px-3 py-2">
                        <table className="w-full text-[12.5px]">
                          <thead className="text-ink-500 text-[11.5px]">
                            <tr>
                              <th className="text-start font-semibold px-2 py-1">#</th>
                              <th className="text-start font-semibold px-2 py-1">שם</th>
                              <th className="text-start font-semibold px-2 py-1">ת.ז.</th>
                              <th className="text-start font-semibold px-2 py-1">נייד</th>
                              <th className="text-start font-semibold px-2 py-1">מייל פרטי</th>
                              <th className="text-start font-semibold px-2 py-1">מייל עבודה</th>
                              <th className="text-start font-semibold px-2 py-1">תפקיד</th>
                              <th className="text-start font-semibold px-2 py-1">משרד</th>
                              <th className="text-start font-semibold px-2 py-1">חברה</th>
                              <th className="text-start font-semibold px-2 py-1">שורה בגיליון</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.participants.map((p) => (
                              <tr key={p.id} className="border-t border-ink-100">
                                <td className="px-2 py-1 text-ink-500">{p.seq}</td>
                                <td className="px-2 py-1 font-semibold text-ink-900">
                                  {p.first_name} {p.last_name}
                                </td>
                                <td className="px-2 py-1" dir="ltr">
                                  {p.national_id}
                                </td>
                                <td className="px-2 py-1" dir="ltr">
                                  {p.phone}
                                </td>
                                <td className="px-2 py-1" dir="ltr">
                                  {p.personal_email}
                                </td>
                                <td className="px-2 py-1" dir="ltr">
                                  {p.work_email ?? ""}
                                </td>
                                <td className="px-2 py-1">{p.role_title ?? ""}</td>
                                <td className="px-2 py-1">{p.department ?? ""}</td>
                                <td className="px-2 py-1">{r.kind === "group" ? r.company : p.company}</td>
                                <td className="px-2 py-1 text-ink-500">{p.sheet_row ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-500">
                  אין הרשמות שמתאימות לסינון.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function NoteCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() !== value.trim()) onSave(v);
      }}
      rows={2}
      placeholder="הערה פנימית…"
      className="w-full rounded-md border border-ink-200 px-2 py-1 text-[12.5px] resize-y min-h-[40px]"
    />
  );
}
