"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Printer, RefreshCw, Search, UserPlus } from "lucide-react";
import { H } from "@/app/ai-course/theme";
import { initDymo, LABELS, loadLabelKey, loadPrinterPref, printLabel, saveLabelKey, savePrinterPref, type LabelKey } from "./dymo";
import type { DymoStatus, Participant } from "./types";

/*
  The desk - the Bolt project's App.tsx, screen for screen (the owner, 27/10):
  a status line (how many participants loaded, is the DYMO printer ready), a
  search over ת.ז. / פרטי / משפחה / משרד / תפקיד / קורס, and a table with
  ״הדפס״ per row. A printed row turns green with a ✓; printing her again asks
  first. The tag reads ״שם לתג״ (or פרטי + משפחה) over ״משרד״. After a print the
  sheet gets הודפס = כן and the list is reloaded from it.
  28/10: a name that is not in the sheet - a small form (first + last name
  required), the tag is printed and she is appended to the sheet with חדש = כן.
*/
const th = "px-3 py-3 text-right text-[12px] font-bold whitespace-nowrap";
const td = "px-3 py-3 whitespace-nowrap text-[13px] text-right";
const fieldCls = "w-full bg-white px-3 py-2.5 text-[15px] outline-none";
const fieldStyle = { border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink } as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/tags/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (r.status === 401) throw new Error("ENTRY");
  return (await r.json()) as T;
}

type ListResult = { ok: true; data: Participant[] } | { ok: false; error: string };
type Outcome = { ok: true } | { ok: false; error: string };

interface WalkInForm {
  first: string;
  last: string;
  office: string;
  tz: string;
}

/** ״דנה לוי״ typed in the search becomes first = דנה, last = לוי in the form. */
function splitName(q: string): { first: string; last: string } {
  const parts = q.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function TagsDesk({ initial, initialError }: { initial: Participant[] | null; initialError: string | null }) {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>(initial ?? []);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(initialError);
  const [dymoStatus, setDymoStatus] = useState<DymoStatus>({ isReady: false, message: "מאתחל...", printers: [] });
  const [isPrinting, setIsPrinting] = useState<number | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [labelKey, setLabelKey] = useState<LabelKey>("30334");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<WalkInForm | null>(null);
  const [walkInError, setWalkInError] = useState<string | null>(null);
  const [walkInBusy, setWalkInBusy] = useState(false);
  const [walkInDone, setWalkInDone] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api<ListResult>("list");
      if (res.ok) {
        setParticipants(res.data);
        setListError(null);
      } else {
        setListError(res.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "ENTRY") {
        router.refresh();
        return;
      }
      setListError("שגיאה בטעינת רשימת המשתתפות - נסי שוב.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // the roll that is loaded, as remembered on this computer (after hydration, so the server markup matches)
      await new Promise((r) => setTimeout(r, 0));
      const key = loadLabelKey();
      if (alive && key !== "30334") setLabelKey(key);
      await new Promise((r) => setTimeout(r, 500));
      const status = await initDymo(loadPrinterPref());
      if (alive) setDymoStatus(status);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filteredParticipants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    const s = (v: string | undefined) => (v || "").toString().toLowerCase();
    return participants.filter((p) => s(p.cols["ת.ז."]).includes(q) || s(p.cols["פרטי"]).includes(q) || s(p.cols["משפחה"]).includes(q) || s(p.cols["משרד"]).includes(q) || s(p.cols["תפקיד"]).includes(q) || s(p.cols["קורס"]).includes(q));
  }, [participants, query]);

  const printerBlocked = (): string | null => (!dymoStatus.isReady || !dymoStatus.printer ? `מדפסת DYMO לא זמינה (${dymoStatus.message}). ודאי שהמדפסת מחוברת ושתוכנת DYMO פועלת במחשב הזה.` : null);

  const handlePrint = async (participant: Participant) => {
    setPrintError(null);
    const blocked = printerBlocked();
    if (blocked) {
      setPrintError(blocked);
      return;
    }
    const isPrinted = participant.cols["הודפס"] === "כן";
    if (isPrinted && !window.confirm("המשתתפת כבר הודפסה. להדפיס שוב?")) return;

    const tz = participant.cols["ת.ז."] ? String(participant.cols["ת.ז."]) : "";
    const first = participant.cols["פרטי"] || "";
    const last = participant.cols["משפחה"] || "";
    if (!tz && !(first && last)) {
      setPrintError("לשורה הזו אין ת.ז. ואין שם מלא - אי אפשר לזהות אותה בגיליון.");
      return;
    }
    setIsPrinting(participant.row);
    try {
      const tagName = participant.cols["שם לתג"] || `${first} ${last}`.trim();
      const officeLine = participant.cols["משרד"] || "";
      await printLabel(tagName, officeLine, dymoStatus.printer!, labelKey);
      const marked = await api<Outcome>("printed", { method: "POST", body: JSON.stringify({ tz, row: participant.row, first, last }) });
      if (!marked.ok) setPrintError(`התג הודפס, אבל הסימון בגיליון נכשל: ${marked.error}`);
      await loadParticipants();
    } catch (error) {
      if (error instanceof Error && error.message === "ENTRY") {
        router.refresh();
        return;
      }
      console.error("Error printing:", error);
      setPrintError(error instanceof Error && error.message ? `${error.message} - נסי שוב.` : "שגיאה בהדפסת התג - נסי שוב.");
    } finally {
      setIsPrinting(null);
    }
  };

  const pickLabel = (key: LabelKey) => {
    setLabelKey(key);
    saveLabelKey(key);
  };

  const pickPrinterName = (name: string) => {
    savePrinterPref(name);
    void initDymo(name).then(setDymoStatus);
  };

  /** A label that says ״בדיקה״ - to see the printer move before the first real tag. Marks nothing. */
  const testPrint = async () => {
    setTestResult(null);
    if (!dymoStatus.isReady || !dymoStatus.printer) {
      setTestResult(`אי אפשר להדפיס ניסיון: ${dymoStatus.message}`);
      return;
    }
    setTesting(true);
    try {
      await printLabel("בדיקה", "הייטקורס", dymoStatus.printer, labelKey);
      setTestResult(`נשלח ל-${dymoStatus.printer}. אם לא יצאה מדבקה - בדקי את תור ההדפסה של המדפסת ב-Windows.`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "שגיאה בהדפסת הניסיון");
    } finally {
      setTesting(false);
    }
  };

  /** Opens the walk-in form, pre-filled from whatever was typed in the search. */
  const openWalkIn = () => {
    const { first, last } = splitName(query);
    setWalkIn({ first, last, office: "", tz: "" });
    setWalkInError(null);
    setWalkInDone(null);
  };

  const walkInDuplicate = useMemo(() => {
    if (!walkIn) return null;
    const f = walkIn.first.trim();
    const l = walkIn.last.trim();
    if (!f || !l) return null;
    return participants.find((p) => (p.cols["פרטי"] || "").trim() === f && (p.cols["משפחה"] || "").trim() === l) ?? null;
  }, [walkIn, participants]);

  /** Print first, then append her to the sheet - a failed print adds nothing. */
  const submitWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkIn) return;
    setWalkInError(null);
    const first = walkIn.first.trim();
    const last = walkIn.last.trim();
    const office = walkIn.office.trim();
    const tz = walkIn.tz.trim();
    if (!first || !last) {
      setWalkInError("שם פרטי ושם משפחה הם חובה.");
      return;
    }
    if (tz && !/^\d{5,9}$/.test(tz)) {
      setWalkInError("ת.ז. צריכה להיות ספרות בלבד.");
      return;
    }
    const blocked = printerBlocked();
    if (blocked) {
      setWalkInError(blocked);
      return;
    }
    setWalkInBusy(true);
    try {
      await printLabel(`${first} ${last}`, office, dymoStatus.printer!, labelKey);
      const added = await api<{ ok: true; row: number } | { ok: false; error: string }>("add", { method: "POST", body: JSON.stringify({ first, last, office, tz }) });
      if (!added.ok) {
        setWalkInError(`התג הודפס, אבל ההוספה לגיליון נכשלה: ${added.error}`);
        return;
      }
      setWalkIn(null);
      setQuery("");
      setWalkInDone(`התג של ${first} ${last} הודפס, והיא נוספה לגיליון עם סימון ״חדש״.`);
      await loadParticipants();
    } catch (error) {
      if (error instanceof Error && error.message === "ENTRY") {
        router.refresh();
        return;
      }
      setWalkInError(error instanceof Error && error.message ? `${error.message} - נסי שוב.` : "שגיאה בהדפסת התג - נסי שוב.");
    } finally {
      setWalkInBusy(false);
    }
  };

  const printedCount = participants.filter((p) => p.cols["הודפס"] === "כן").length;
  const newCount = participants.filter((p) => p.cols["חדש"] === "כן").length;

  return (
    <div className="flex flex-col gap-5" data-testid="tags-desk">
      <header className="text-center">
        <h1 className="text-[30px] font-black" style={{ color: H.navy }}>
          מערכת הדפסת תגים
        </h1>
        <p className="mt-1 text-[14.5px]" style={{ color: H.muted }}>
          מערכת ניהול והדפסת תגים למשתתפות
        </p>
      </header>

      <div className="bg-white p-4" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
        <div className="flex flex-wrap items-center justify-between gap-4 text-[14px]">
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: H.ink }}>
              סטטוס מערכת:
            </span>
            {isLoading ? (
              <span style={{ color: H.navy }}>טוען נתונים...</span>
            ) : listError ? (
              <span style={{ color: H.red }} data-testid="tags-list-error">
                {listError}
              </span>
            ) : (
              <span style={{ color: H.green }} data-testid="tags-loaded">
                נטענו {participants.length} משתתפות{printedCount ? ` · הודפסו ${printedCount}` : ""}
                {newCount ? ` · חדשות ${newCount}` : ""}
              </span>
            )}
            <button type="button" onClick={() => void loadParticipants()} disabled={isLoading} className="inline-flex items-center gap-1 text-[12.5px] font-semibold underline disabled:opacity-50" style={{ color: H.muted }} data-testid="tags-reload">
              <RefreshCw size={13} /> רענון
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: H.ink }}>
                מדפסת:
              </span>
              <span className="flex items-center gap-2" style={{ color: dymoStatus.isReady ? H.green : H.red }} data-testid="tags-printer" data-ready={dymoStatus.isReady ? "1" : "0"}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: dymoStatus.isReady ? H.green : H.red }} />
                {dymoStatus.message}
              </span>
              <button type="button" onClick={() => void initDymo(loadPrinterPref()).then(setDymoStatus)} className="text-[12.5px] font-semibold underline" style={{ color: H.muted }} data-testid="tags-printer-check">
                בדיקה
              </button>
            </div>
            {dymoStatus.printers.length > 0 && (
              <label className="flex items-center gap-2 text-[13px]" style={{ color: H.ink }}>
                להדפיס על:
                <select value={dymoStatus.printer ?? ""} onChange={(e) => pickPrinterName(e.target.value)} className="bg-white px-2 py-1 text-[13px]" style={{ border: `1px solid ${H.line}`, borderRadius: 8 }} data-testid="tags-printer-pick">
                  {dymoStatus.printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                      {p.connected ? "" : " (לא מחוברת)"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" onClick={() => void testPrint()} disabled={testing} className="px-3 py-1 text-[12.5px] font-bold disabled:opacity-50" style={{ background: H.yellow, color: H.navy, borderRadius: 8 }} data-testid="tags-test-print">
              {testing ? "מדפיסה..." : "הדפסת ניסיון"}
            </button>
            <label className="flex items-center gap-2 text-[13px]" style={{ color: H.ink }}>
              מדבקה:
              <select value={labelKey} onChange={(e) => pickLabel(e.target.value as LabelKey)} className="bg-white px-2 py-1 text-[13px]" style={{ border: `1px solid ${H.line}`, borderRadius: 8 }} data-testid="tags-label">
                {(Object.keys(LABELS) as LabelKey[]).map((k) => (
                  <option key={k} value={k}>
                    {LABELS[k].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white p-4" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי ת.ז., שם פרטי, שם משפחה, משרד, תפקיד או קורס..."
              className="w-full py-3 pl-4 pr-10 text-right text-[15px] outline-none"
              style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
              data-testid="tags-search"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2" size={20} style={{ color: H.muted }} />
          </div>
          <button type="button" onClick={openWalkIn} className="inline-flex items-center gap-1.5 px-4 py-3 text-[14px] font-bold" style={{ background: H.yellowSoft, color: H.navy, borderRadius: 10, border: `1px solid ${H.yellow}` }} data-testid="tags-add">
            <UserPlus size={16} />
            משתתפת שלא ברשימה
          </button>
        </div>
      </div>

      {walkIn && (
        <form onSubmit={submitWalkIn} className="bg-white p-5" style={{ border: `1.5px solid ${H.yellow}`, borderRadius: 12 }} data-testid="tags-add-form">
          <h2 className="text-[17px] font-black" style={{ color: H.navy }}>
            משתתפת שלא ברשימה
          </h2>
          <p className="mt-1 text-[13.5px]" style={{ color: H.muted }}>
            שם פרטי ושם משפחה חובה; השאר רשות. התג יודפס והיא תתווסף לגיליון בסימון ״חדש״.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="walkin-first" className="block text-[13px] font-bold" style={{ color: H.navy }}>
                שם פרטי
              </label>
              <input id="walkin-first" value={walkIn.first} onChange={(e) => setWalkIn({ ...walkIn, first: e.target.value })} required className={fieldCls} style={fieldStyle} data-testid="walkin-first" />
            </div>
            <div className="space-y-1">
              <label htmlFor="walkin-last" className="block text-[13px] font-bold" style={{ color: H.navy }}>
                שם משפחה
              </label>
              <input id="walkin-last" value={walkIn.last} onChange={(e) => setWalkIn({ ...walkIn, last: e.target.value })} required className={fieldCls} style={fieldStyle} data-testid="walkin-last" />
            </div>
            <div className="space-y-1">
              <label htmlFor="walkin-office" className="block text-[13px] font-bold" style={{ color: H.navy }}>
                משרד <span className="font-normal" style={{ color: H.muted }}>(רשות)</span>
              </label>
              <input id="walkin-office" value={walkIn.office} onChange={(e) => setWalkIn({ ...walkIn, office: e.target.value })} className={fieldCls} style={fieldStyle} data-testid="walkin-office" />
            </div>
            <div className="space-y-1">
              <label htmlFor="walkin-tz" className="block text-[13px] font-bold" style={{ color: H.navy }}>
                ת.ז. <span className="font-normal" style={{ color: H.muted }}>(רשות)</span>
              </label>
              <input id="walkin-tz" dir="ltr" inputMode="numeric" value={walkIn.tz} onChange={(e) => setWalkIn({ ...walkIn, tz: e.target.value })} className={fieldCls} style={fieldStyle} data-testid="walkin-tz" />
            </div>
          </div>
          {walkInDuplicate && (
            <p className="mt-3 text-[13.5px] font-medium" style={{ color: "#8C5E0E" }} data-testid="walkin-duplicate">
              יש כבר {walkInDuplicate.cols["פרטי"]} {walkInDuplicate.cols["משפחה"]} ברשימה{walkInDuplicate.cols["משרד"] ? ` (${walkInDuplicate.cols["משרד"]})` : ""} - אולי עדיף להדפיס לה מהטבלה.
            </p>
          )}
          {walkInError && (
            <p role="alert" className="mt-3 px-4 py-3 text-[14px] font-medium" style={{ background: "#FBEAE8", color: H.red, borderRadius: 10 }} data-testid="walkin-error">
              {walkInError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={walkInBusy} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: H.navy, borderRadius: 10 }} data-testid="walkin-submit">
              <Printer size={15} />
              {walkInBusy ? "מדפיסה ומוסיפה..." : "הדפסה והוספה לגיליון"}
            </button>
            <button type="button" onClick={() => setWalkIn(null)} disabled={walkInBusy} className="px-4 py-2.5 text-[14px] font-semibold underline disabled:opacity-50" style={{ color: H.muted }} data-testid="walkin-cancel">
              ביטול
            </button>
          </div>
        </form>
      )}

      {walkInDone && (
        <p className="px-4 py-3 text-[14px] font-medium" style={{ background: "#E9F6EE", color: H.green, borderRadius: 10 }} data-testid="walkin-done">
          {walkInDone}
        </p>
      )}
      {testResult && (
        <p className="px-4 py-3 text-[14px] font-medium" style={{ background: testResult.startsWith("נשלח") ? "#E9F6EE" : "#FBEAE8", color: testResult.startsWith("נשלח") ? H.green : H.red, borderRadius: 10 }} data-testid="tags-test-print-result">
          {testResult}
        </p>
      )}
      {dymoStatus.detail && (
        <details className="text-[12.5px]" style={{ color: H.muted }} data-testid="tags-dymo-detail">
          <summary className="cursor-pointer select-none">פרטים טכניים - מה DYMO ענה</summary>
          <pre dir="ltr" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-white p-3 text-left text-[11.5px]" style={{ border: `1px solid ${H.line}`, borderRadius: 8, color: H.ink }}>
            {dymoStatus.detail}
          </pre>
        </details>
      )}
      {printError && (
        <p role="alert" className="px-4 py-3 text-[14px] font-medium" style={{ background: "#FBEAE8", color: H.red, borderRadius: 10 }} data-testid="tags-print-error">
          {printError}
        </p>
      )}

      {isLoading && participants.length === 0 ? (
        <div className="bg-white p-12 text-center" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2" style={{ borderColor: H.navy }} />
          <p className="text-[16px]" style={{ color: H.muted }}>
            טוען רשימת משתתפות...
          </p>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="bg-white p-8 text-center" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }} data-testid="tags-empty">
          <p className="text-[16px]" style={{ color: H.muted }}>
            לא נמצאו משתתפות
          </p>
          {query.trim() && !walkIn && (
            <button type="button" onClick={openWalkIn} className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 text-[14.5px] font-bold" style={{ background: H.yellow, color: H.navy, borderRadius: 10 }} data-testid="tags-add-from-search">
              <UserPlus size={16} />
              להוסיף את ״{query.trim()}״ ולהדפיס לה תג
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden bg-white" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead style={{ background: H.row }}>
                <tr style={{ color: H.muted }}>
                  <th className={th} style={{ width: 110 }}>
                    ת.ז.
                  </th>
                  <th className={th} style={{ width: 120 }}>
                    שם פרטי
                  </th>
                  <th className={th} style={{ width: 120 }}>
                    שם משפחה
                  </th>
                  <th className={th} style={{ width: 160 }}>
                    משרד
                  </th>
                  <th className={th} style={{ width: 80 }}>
                    סטטוס
                  </th>
                  <th className={th} style={{ width: 150 }}>
                    הודפס ב
                  </th>
                  <th className={th} style={{ width: 120 }}>
                    פעולה
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => {
                  const isPrinted = participant.cols["הודפס"] === "כן";
                  const isNew = participant.cols["חדש"] === "כן";
                  const tz = participant.cols["ת.ז."] ? String(participant.cols["ת.ז."]) : "";
                  const isCurrentlyPrinting = isPrinting === participant.row;
                  return (
                    <tr key={participant.row} style={{ borderTop: `1px solid ${H.line}`, background: isPrinted ? "#E9F6EE" : undefined }} data-testid="tags-row" data-tz={tz} data-row={participant.row} data-printed={isPrinted ? "1" : "0"} data-new={isNew ? "1" : "0"}>
                      <td className={td} dir="ltr" style={{ color: H.ink, fontFamily: "var(--font-jetbrains), monospace", textAlign: "right" }}>
                        {tz || <span style={{ color: H.muted }}>-</span>}
                      </td>
                      <td className={`${td} font-semibold`} style={{ color: H.ink }}>
                        {participant.cols["פרטי"] || ""}
                      </td>
                      <td className={`${td} font-semibold`} style={{ color: H.ink }}>
                        {participant.cols["משפחה"] || ""}
                      </td>
                      <td className={td} style={{ color: H.ink }}>
                        {participant.cols["משרד"] || ""}
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2">
                          {isPrinted ? (
                            <span className="inline-flex items-center gap-1 font-bold" style={{ color: H.green }} aria-label="הודפס">
                              <Check size={16} />
                            </span>
                          ) : (
                            <span style={{ color: H.muted }}>-</span>
                          )}
                          {isNew && (
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: H.yellowSoft, color: H.navy, border: `1px solid ${H.yellow}` }} data-testid="tags-new-pill">
                              חדש
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={td} dir="ltr" style={{ color: H.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-testid="tags-printed-at">
                        {participant.cols["תאריך ושעת ההדפסה"] || ""}
                      </td>
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() => void handlePrint(participant)}
                          disabled={isCurrentlyPrinting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: H.navy, borderRadius: 8 }}
                          data-testid="tags-print"
                        >
                          <Printer size={14} />
                          {isCurrentlyPrinting ? "מדפיסה..." : "הדפס"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
