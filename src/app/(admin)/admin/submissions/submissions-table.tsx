"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui";

export interface SubmissionRow {
  id: string;
  profileId: string;
  jobId: string;
  name: string;
  specialization: string;
  studyPlace: string;
  graduationYear: string;
  phone: string;
  email: string;
  jobTitle: string;
  clientCompany: string;
  submittedAt: string;
  sentAt: string | null;
  status: string;
  crmNote: string | null;
}

const STATUS_HE: Record<string, string> = {
  submitted: "אושרה סופית",
  in_review: "אושרה סופית",
  accepted: "אושרה סופית",
  sent: "הוגשה ללקוח",
  interview: "בראיונות",
  exam: "במבחן",
  hired: "גויסה 🎉",
  declined: "לא התקדם",
};

const DMY = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

const PAGE_SIZE = 25;

export function SubmissionsTable({ rows }: { rows: SubmissionRow[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.name} ${r.specialization} ${r.studyPlace} ${r.phone} ${r.email} ${r.jobTitle} ${r.clientCompany}`
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function exportCsv() {
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "שם",
      "התמחות",
      "מוסד לימודים",
      "שנת סיום",
      "טלפון",
      "מייל",
      "משרה",
      "חברה",
      "הוגשה בתאריך",
      "נשלחה ללקוח",
      "סטטוס",
    ];
    const body = filtered.map((r) => [
      r.name,
      r.specialization,
      r.studyPlace,
      r.graduationYear,
      r.phone,
      r.email,
      r.jobTitle,
      r.clientCompany,
      DMY.format(new Date(r.submittedAt)),
      r.sentAt ? DMY.format(new Date(r.sentAt)) : "",
      STATUS_HE[r.status] ?? r.status,
    ]);
    const csv = "﻿" + [header, ...body].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "submissions.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-ink-200 rounded-md p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="חיפוש לפי שם / חברה / משרה / לימודים…"
            className="w-full ps-9 pe-3 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white bg-brand-gradient rounded-md px-3.5 py-2 cursor-pointer"
        >
          <Download size={13} /> ייצוא לאקסל ({filtered.length})
        </button>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {["שם", "מוסד לימודים", "שנת סיום", "טלפון", "מייל", "משרה", "חברה", "תאריך", "סטטוס"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200 whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td className="p-2 border-b border-ink-100">
                  <Link
                    href={`/admin/members/${r.profileId}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline whitespace-nowrap"
                  >
                    {r.name}
                  </Link>
                  {r.crmNote && (
                    <span
                      className="inline-flex ms-1.5 text-[#8C5E0E] align-middle"
                      title={`הערה פנימית: ${r.crmNote}`}
                    >
                      <StickyNote size={13} />
                    </span>
                  )}
                  {r.specialization && (
                    <div className="text-[11px] text-ink-500">{r.specialization}</div>
                  )}
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{r.studyPlace || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{r.graduationYear || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-700 whitespace-nowrap" dir="ltr">
                  {r.phone || "—"}
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700" dir="ltr">
                  {r.email || "—"}
                </td>
                <td className="p-2 border-b border-ink-100">
                  <Link
                    href={`/admin/jobs/${r.jobId}?tab=review`}
                    className="text-brand-purple hover:underline"
                  >
                    {r.jobTitle}
                  </Link>
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{r.clientCompany}</td>
                <td className="p-2 border-b border-ink-100 text-ink-500 whitespace-nowrap">
                  {DMY.format(new Date(r.sentAt ?? r.submittedAt))}
                </td>
                <td className="p-2 border-b border-ink-100">
                  <Badge variant={r.status === "hired" ? "grad" : r.sentAt ? "purple" : "mint"}>
                    {STATUS_HE[r.status] ?? r.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-ink-500">
                  {rows.length === 0
                    ? "עוד לא אושרו הגשות סופית — ברגע שתסמנו 'אישור סופי' במשרה, הן יופיעו כאן."
                    : "לא נמצאו הגשות בחיפוש הזה."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="text-[12.5px] font-semibold text-brand-purple disabled:text-ink-300 cursor-pointer disabled:cursor-default"
          >
            → הקודם
          </button>
          <span className="text-[12px] text-ink-500">
            עמוד {safePage + 1} מתוך {pages}
          </span>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
            className="text-[12.5px] font-semibold text-brand-purple disabled:text-ink-300 cursor-pointer disabled:cursor-default"
          >
            הבא ←
          </button>
        </div>
      )}
    </div>
  );
}
