"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Delete, IdCard, Printer, SearchX, Settings, TriangleAlert, X } from "lucide-react";
import { DYMO_SERVICE_URL, initDymo, LABELS, loadLabelKey, loadPrinterPref, printLabel, saveLabelKey, savePrinterPref, type LabelKey } from "../dymo";
import type { DymoStatus, Participant } from "../types";

/*
  The self-service screen (the owner, 23/11): a 1920×1080 stage scaled to
  whatever screen it runs on, in the Hightecourse colours on navy. Two steps
  side by side - the on-screen keypad for the ת.ז. on the right, the result on
  the left: her name as it will be printed, one big yellow ״הדפסת התג שלי״,
  a ״done״ screen that returns to the start by itself. Everything a
  participant can touch is at least 96px tall. The printer, the label roll
  and ״הדפסת ניסיון״ are behind the small ״הגדרות״ in the corner, for the
  staff who set the computer up; the DYMO side is the desk's own dymo.ts.
*/
const STAGE_W = 1920;
const STAGE_H = 1080;
const MAX_DIGITS = 9;
/** Walk-ins at the desk may carry 5-9 digits; the sheet decides what matches. */
const MIN_DIGITS = 5;
/** The ״done״ screen goes back to the start by itself - the next participant finds a clean screen. */
const DONE_RESET_MS = 8_000;
/** A half-typed number or an unanswered card is cleared after a minute without a touch. */
const IDLE_RESET_MS = 60_000;

export type KioskMode = "ready" | "enter" | "no-sheet" | "no-code";

type Step =
  | { kind: "idle" }
  | { kind: "searching"; tz: string }
  | { kind: "found"; p: Participant }
  | { kind: "printing"; p: Participant }
  | { kind: "done"; p: Participant }
  | { kind: "notfound"; tz: string }
  | { kind: "error"; message: string };

type FindResult = { ok: true; data: Participant | null } | { ok: false; error: string };
type Outcome = { ok: true } | { ok: false; error: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/tags/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (r.status === 401) throw new Error("ENTRY");
  return (await r.json()) as T;
}

const tagNameOf = (p: Participant) => p.cols["שם לתג"] || `${p.cols["פרטי"] || ""} ${p.cols["משפחה"] || ""}`.trim();
const officeOf = (p: Participant) => p.cols["משרד"] || "";

const CSS = `
.hk{position:fixed;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 800px at 80% 10%,#06558A 0%,#003A61 55%,#022C4A 100%);color:#fff;
  -webkit-font-smoothing:antialiased;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;
  --yellow:#F8C800;--navy:#004878;--ink:#FFFFFF;--muted:#B9CDDE;--panel:rgba(255,255,255,.07);--panel-line:rgba(255,255,255,.16);--key:#0E5586;--key-on:#1B6BA3;--green:#3DBB7A;--red:#FF7366}
.hk *{box-sizing:border-box}
.hk button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0;margin:0}
.hk .stage{width:1920px;height:1080px;flex:none;position:relative;display:flex;flex-direction:column;padding:36px 72px 28px;transform-origin:center;transition:opacity .25s}
.hk .top{display:flex;align-items:center;justify-content:space-between;gap:40px;height:112px;flex-shrink:0}
.hk .brand{display:flex;align-items:center;gap:36px;min-width:0}
.hk .ttl{font-size:46px;font-weight:900;line-height:1.05;white-space:nowrap}
.hk .sub{font-size:23px;font-weight:500;color:var(--muted);margin-top:8px;white-space:nowrap}
.hk .pill{display:flex;align-items:center;gap:14px;padding:16px 26px;border-radius:999px;background:var(--panel);border:2px solid var(--panel-line);font-size:24px;font-weight:700;white-space:nowrap}
.hk .dot{width:18px;height:18px;border-radius:50%;flex:none;background:var(--green);box-shadow:0 0 0 6px rgba(61,187,122,.18)}
.hk .pill[data-ready="0"] .dot{background:var(--red);box-shadow:0 0 0 6px rgba(255,115,102,.18)}
.hk .pill[data-ready="0"]{border-color:rgba(255,115,102,.5)}
.hk .rule{height:5px;border-radius:3px;background:linear-gradient(270deg,var(--yellow),rgba(248,200,0,.15));margin:16px 0 28px;flex-shrink:0}
.hk .body{flex:1;display:flex;gap:64px;min-height:0}
.hk .col{display:flex;flex-direction:column;min-height:0}
.hk .entry{width:736px;flex:none;gap:18px}
.hk .result{flex:1;min-width:0;gap:18px}
.hk .step{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:800;line-height:1;flex-shrink:0}
.hk .num{width:52px;height:52px;border-radius:50%;background:var(--yellow);color:var(--navy);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;flex:none}
.hk .digits{display:flex;gap:8px;direction:ltr;justify-content:center}
.hk .cell{width:74px;height:94px;border-radius:14px;background:var(--panel);border:2px solid var(--panel-line);display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
.hk .cell.on{border-color:var(--yellow);background:rgba(248,200,0,.1)}
.hk .cell.cursor{border-color:rgba(248,200,0,.6);animation:hkBlink 1.1s step-end infinite}
@keyframes hkBlink{50%{border-color:var(--panel-line)}}
.hk .keys{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;direction:ltr}
.hk .key{height:98px;border-radius:18px;background:var(--key);border:2px solid rgba(255,255,255,.08);font-size:46px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:12px;line-height:1;transition:transform .08s,background .12s}
.hk .key:active{background:var(--key-on);transform:scale(.96)}
.hk .key.fn{font-size:26px;font-weight:700;background:rgba(255,255,255,.06)}
.hk .key:disabled{opacity:.35;cursor:default;transform:none}
.hk .btn{height:98px;border-radius:20px;font-size:34px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:18px;line-height:1;transition:transform .08s,opacity .15s;width:100%}
.hk .btn:active{transform:scale(.97)}
.hk .btn.primary{background:var(--yellow);color:var(--navy);box-shadow:0 14px 40px rgba(248,200,0,.25)}
.hk .btn.primary:disabled{opacity:.35;box-shadow:none;cursor:default;transform:none}
.hk .btn.ghost{background:transparent;border:3px solid rgba(255,255,255,.35);color:#fff;font-weight:700}
.hk .card{flex:1;min-height:0;border-radius:30px;background:var(--panel);border:2px solid var(--panel-line);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 56px;gap:22px;position:relative;overflow:hidden}
.hk .card.found{border-color:rgba(248,200,0,.55)}
.hk .card.done{border-color:rgba(61,187,122,.6);background:rgba(61,187,122,.1)}
.hk .card.bad{border-color:rgba(255,115,102,.55)}
.hk .hello{font-size:34px;font-weight:600;color:var(--muted)}
.hk .name{font-size:76px;font-weight:900;line-height:1.1;max-width:100%;overflow-wrap:anywhere}
.hk .office{font-size:40px;font-weight:600;line-height:1.2;max-width:100%}
.hk .chips{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.hk .chip{padding:10px 22px;border-radius:999px;border:2px solid var(--panel-line);font-size:22px;font-weight:600;color:var(--muted)}
.hk .note{margin-top:4px;padding:16px 26px;border-radius:16px;background:rgba(248,200,0,.12);border:2px solid rgba(248,200,0,.4);font-size:24px;font-weight:600;line-height:1.35;max-width:820px}
.hk .actions{display:flex;flex-direction:column;gap:16px;width:min(100%,760px);margin-top:12px}
.hk .h1{font-size:60px;font-weight:900;line-height:1.1}
.hk .p{font-size:30px;font-weight:500;line-height:1.4;color:var(--muted);max-width:820px}
.hk .p b{color:#fff;font-weight:800}
.hk .big-tz{font-size:64px;font-weight:900;direction:ltr;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.hk .empty{color:var(--muted);opacity:.75}
.hk .spin{width:84px;height:84px;border-radius:50%;border:8px solid rgba(255,255,255,.15);border-top-color:var(--yellow);animation:hkSpin .9s linear infinite}
@keyframes hkSpin{to{transform:rotate(360deg)}}
.hk .foot{display:flex;align-items:center;justify-content:space-between;gap:24px;height:56px;flex-shrink:0;margin-top:14px;font-size:20px;color:var(--muted)}
.hk .tagline{color:var(--yellow);font-weight:800;font-size:22px}
.hk .gear{display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:999px;border:2px solid var(--panel-line);font-size:20px;font-weight:700;color:var(--muted)}
.hk .gear:active{background:var(--panel)}
.hk .gate{flex:1;display:flex;align-items:center;justify-content:center}
.hk .gate-card{width:860px;border-radius:30px;background:var(--panel);border:2px solid var(--panel-line);padding:30px 48px;display:flex;flex-direction:column;gap:16px;align-items:center;text-align:center}
.hk .gate-card .h1{font-size:48px}
.hk .gate-card .p{font-size:24px;line-height:1.3}
.hk .gate-card .keys{width:100%;gap:12px}
.hk .gate-card .key{height:80px;font-size:40px}
.hk .gate-card .key.fn{font-size:24px}
.hk .gate-card .btn{width:100%;height:84px;font-size:30px}
.hk .gate-card .err{font-size:22px;padding:12px 22px}
.hk .code{width:100%;height:84px;border-radius:18px;background:rgba(0,0,0,.25);border:2px solid var(--panel-line);color:#fff;font:inherit;font-size:40px;font-weight:800;letter-spacing:.35em;text-align:center;direction:ltr;outline:none}
.hk .code:focus{border-color:var(--yellow)}
.hk .err{padding:16px 26px;border-radius:16px;background:rgba(255,115,102,.14);border:2px solid rgba(255,115,102,.5);font-size:24px;font-weight:600;line-height:1.35;width:100%}
.hk .staff{position:absolute;inset:0;background:rgba(0,20,40,.78);display:flex;align-items:center;justify-content:center;z-index:5}
.hk .staff-card{width:1100px;max-height:960px;overflow:auto;border-radius:26px;background:#F6F8FA;color:#1C2B3A;padding:30px 36px;display:flex;flex-direction:column;gap:18px;font-size:20px;line-height:1.45;text-align:right}
.hk .staff-card h2{font-size:30px;font-weight:900;color:var(--navy);margin:0}
.hk .staff-card .row{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
.hk .staff-card select{font:inherit;font-size:20px;padding:12px 16px;border-radius:12px;border:1.5px solid #D9E2EC;background:#fff;color:#1C2B3A;min-height:60px}
.hk .staff-card .sb{min-height:60px;padding:0 26px;border-radius:14px;background:var(--navy);color:#fff;font-size:20px;font-weight:800;display:inline-flex;align-items:center;gap:10px}
.hk .staff-card .sb.light{background:#fff;color:var(--navy);border:2px solid var(--navy)}
.hk .staff-card .sb:disabled{opacity:.5}
.hk .staff-card a{color:var(--navy);font-weight:700;text-decoration:underline}
.hk .staff-card .help{background:#FFF4C2;border:1.5px solid var(--yellow);border-radius:14px;padding:14px 20px}
.hk .staff-card .help ol{margin:8px 0 0;padding-right:24px}
.hk .staff-card pre{white-space:pre-wrap;word-break:break-all;direction:ltr;text-align:left;font-size:13px;line-height:1.35;background:#fff;border:1px solid #D9E2EC;border-radius:10px;padding:12px;max-height:220px;overflow:auto;margin:0}
.hk .staff-card .muted{color:#5E7183;font-size:17px}
`;

/** The stage is drawn at 1920×1080 and scaled to the screen it runs on - the design holds on a smaller monitor too. */
function useStageScale(): number | null {
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

/** Twelve big keys: the digits, ״מחיקה״ (one back) and ״ניקוי״ (all). */
function Keypad({ onDigit, onBack, onClear, disabled }: { onDigit: (d: string) => void; onBack: () => void; onClear: () => void; disabled?: boolean }) {
  return (
    <div className="keys" data-testid="tags-kiosk-keys">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className="key" onClick={() => onDigit(d)} disabled={disabled} data-testid={`tags-kiosk-key-${d}`} aria-label={d}>
          {d}
        </button>
      ))}
      <button type="button" className="key fn" onClick={onBack} disabled={disabled} data-testid="tags-kiosk-key-back" aria-label="מחיקה">
        <Delete size={34} />
        מחיקה
      </button>
      <button type="button" className="key" onClick={() => onDigit("0")} disabled={disabled} data-testid="tags-kiosk-key-0" aria-label="0">
        0
      </button>
      <button type="button" className="key fn" onClick={onClear} disabled={disabled} data-testid="tags-kiosk-key-clear" aria-label="ניקוי">
        <X size={32} />
        ניקוי
      </button>
    </div>
  );
}

function Frame({ fontClass, build, children, pill, onStaff }: { fontClass: string; build: string; children: React.ReactNode; pill?: React.ReactNode; onStaff?: () => void }) {
  const scale = useStageScale();
  return (
    <div dir="rtl" className={`hk ${fontClass}`} data-testid="tags-kiosk-frame">
      <style>{CSS}</style>
      <div className="stage" style={{ transform: `scale(${scale ?? 1})`, opacity: scale === null ? 0 : 1 }}>
        <header className="top">
          <div className="brand">
            <Image src="/ai-course/hightecourse-dark.png" alt="הייטקורס - לחשוב בגדול" width={1428} height={417} priority style={{ height: 78, width: "auto" }} />
            <div>
              <div className="ttl">הדפסת תג בשירות עצמי</div>
              <div className="sub">מקלידים את מספר תעודת הזהות, מאשרים - והתג יוצא מהמדפסת</div>
            </div>
          </div>
          {pill}
        </header>
        <div className="rule" />
        {children}
        <footer className="foot">
          <span className="tagline">הייטקורס. להתמקצע מהטובים ביותר</span>
          <span data-testid="tags-build">גרסה {build}</span>
          {onStaff ? (
            <button type="button" className="gear" onClick={onStaff} data-testid="tags-kiosk-staff" aria-label="הגדרות לצוות">
              <Settings size={22} />
              הגדרות
            </button>
          ) : (
            <span />
          )}
        </footer>
      </div>
    </div>
  );
}

/** The door - the same entry code as /tags, typed on the keypad (or a keyboard); a cookie for a month on this computer. */
function KioskGate({ fontClass, build }: { fontClass: string; build: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const j = await api<{ ok: boolean; error?: string }>("enter", { method: "POST", body: JSON.stringify({ code }) });
      if (!j.ok) {
        setError(j.error || "הקוד לא נכון - נסי שוב.");
        setCode("");
        return;
      }
      router.refresh();
    } catch {
      setError("החיבור נקטע לרגע - נסי שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame fontClass={fontClass} build={build}>
      <div className="gate">
        <form
          className="gate-card"
          data-testid="tags-kiosk-gate"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="h1">קוד כניסה</div>
          <p className="p">המסך הזה נפתח פעם אחת בכל מחשב עם קוד הכניסה של מערכת התגים.</p>
          <input
            className="code"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="קוד כניסה"
            data-testid="tags-kiosk-code"
          />
          <Keypad onDigit={(d) => setCode((c) => c + d)} onBack={() => setCode((c) => c.slice(0, -1))} onClear={() => setCode("")} disabled={busy} />
          {error && (
            <p role="alert" className="err" data-testid="tags-kiosk-gate-error">
              {error}
            </p>
          )}
          <button type="submit" className="btn primary" disabled={!code || busy} data-testid="tags-kiosk-enter">
            {busy ? "רגע..." : "כניסה"}
          </button>
        </form>
      </div>
    </Frame>
  );
}

function KioskNotice({ fontClass, build, mode }: { fontClass: string; build: string; mode: "no-sheet" | "no-code" }) {
  return (
    <Frame fontClass={fontClass} build={build}>
      <div className="gate">
        <div className="gate-card" data-testid={mode === "no-sheet" ? "tags-kiosk-not-configured" : "tags-kiosk-no-code"}>
          <div className="h1">{mode === "no-sheet" ? "המערכת עוד לא חוברה לגיליון" : "עוד לא נקבע קוד כניסה"}</div>
          <p className="p">
            {mode === "no-sheet"
              ? "מנהלת צריכה להזין את הקישור לגיליון המשתתפות בניהול הייטקורס."
              : "הגיליון מחובר, אבל כדי להיכנס בלי חשבון מנהלת צריך קוד כניסה - מנהלת קובעת אותו בכרטיס ״מערכת הדפסת תגים״ בניהול הייטקורס."}
          </p>
        </div>
      </div>
    </Frame>
  );
}

function KioskReady({ fontClass, build }: { fontClass: string; build: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [dymo, setDymo] = useState<DymoStatus>({ isReady: false, message: "מאתחל...", printers: [] });
  const [labelKey, setLabelKey] = useState<LabelKey>("30334");
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffNote, setStaffNote] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const lastTouch = useRef(0);
  const lookup = useRef(0);
  // the keyboard handler and the idle timer read the current step / digits without being re-bound on every change
  const stepRef = useRef<Step>({ kind: "idle" });
  const digitsRef = useRef("");
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);

  const touch = () => {
    lastTouch.current = Date.now();
  };

  const checkPrinter = useCallback(async (preferred?: string | null) => {
    setChecking(true);
    try {
      setDymo(await initDymo(preferred ?? loadPrinterPref()));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    lastTouch.current = Date.now();
    (async () => {
      // the roll and the printer remembered on this computer (after hydration, so the server markup matches)
      await new Promise((r) => setTimeout(r, 0));
      const key = loadLabelKey();
      if (alive && key !== "30334") setLabelKey(key);
      await new Promise((r) => setTimeout(r, 500));
      const status = await initDymo(loadPrinterPref());
      if (alive) setDymo(status);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reset = useCallback(() => {
    lookup.current += 1;
    setDigits("");
    setStep({ kind: "idle" });
  }, []);

  // the screen cleans itself: ״done״ after a few seconds, anything else after a minute without a touch
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = stepRef.current;
      const idle = Date.now() - lastTouch.current;
      if (s.kind === "done" && idle > DONE_RESET_MS) reset();
      else if ((s.kind !== "idle" || digitsRef.current) && s.kind !== "searching" && s.kind !== "printing" && idle > IDLE_RESET_MS) reset();
    }, 1000);
    return () => window.clearInterval(id);
  }, [reset]);

  const addDigit = useCallback((d: string) => {
    lastTouch.current = Date.now();
    const s = stepRef.current;
    if (s.kind === "searching" || s.kind === "printing") return;
    if (s.kind !== "idle") setStep({ kind: "idle" });
    setDigits((v) => (v.length >= MAX_DIGITS ? v : v + d));
  }, []);
  const back = useCallback(() => {
    lastTouch.current = Date.now();
    const s = stepRef.current;
    if (s.kind === "searching" || s.kind === "printing") return;
    if (s.kind !== "idle") setStep({ kind: "idle" });
    setDigits((v) => v.slice(0, -1));
  }, []);

  const search = useCallback(async () => {
    touch();
    const tz = digitsRef.current;
    if (tz.length < MIN_DIGITS) return;
    const s = stepRef.current;
    if (s.kind === "searching" || s.kind === "printing") return;
    const mine = ++lookup.current;
    setStep({ kind: "searching", tz });
    try {
      const r = await api<FindResult>(`find?tz=${encodeURIComponent(tz)}`);
      if (mine !== lookup.current) return;
      if (!r.ok) setStep({ kind: "error", message: r.error });
      else if (!r.data) setStep({ kind: "notfound", tz });
      else setStep({ kind: "found", p: r.data });
    } catch (e) {
      if (e instanceof Error && e.message === "ENTRY") {
        router.refresh();
        return;
      }
      if (mine === lookup.current) setStep({ kind: "error", message: "החיבור נקטע לרגע." });
    }
  }, [router]);

  const printerReady = dymo.isReady && !!dymo.printer;

  const print = useCallback(async () => {
    touch();
    const s = stepRef.current;
    if (s.kind !== "found") return;
    if (!printerReady) {
      setStep({ kind: "error", message: "המדפסת לא מחוברת כרגע." });
      return;
    }
    const p = s.p;
    setStep({ kind: "printing", p });
    try {
      await printLabel(tagNameOf(p), officeOf(p), dymo.printer!, labelKey);
      const marked = await api<Outcome>("printed", { method: "POST", body: JSON.stringify({ tz: p.cols["ת.ז."] ?? "", row: p.row, first: p.cols["פרטי"] ?? "", last: p.cols["משפחה"] ?? "" }) });
      // the tag is in her hand either way; a failed mark is for the staff, not for her
      if (!marked.ok) setStaffNote(`${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} - התג של ${tagNameOf(p)} הודפס, אבל הסימון בגיליון נכשל: ${marked.error}`);
      touch();
      setStep({ kind: "done", p });
    } catch (e) {
      if (e instanceof Error && e.message === "ENTRY") {
        router.refresh();
        return;
      }
      setStep({ kind: "error", message: e instanceof Error && e.message ? e.message : "שגיאה בהדפסת התג." });
    }
  }, [printerReady, dymo.printer, labelKey, router]);

  // a physical keyboard works too: digits, Backspace, Enter, Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (staffOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        addDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const s = stepRef.current;
        if (s.kind === "found") void print();
        else if (s.kind === "done") reset();
        else void search();
      } else if (e.key === "Escape") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [staffOpen, addDigit, back, print, search, reset]);

  const pickLabel = (key: LabelKey) => {
    setLabelKey(key);
    saveLabelKey(key);
  };
  const pickPrinter = (name: string) => {
    savePrinterPref(name);
    void checkPrinter(name);
  };
  const testPrint = async () => {
    if (!printerReady) {
      setStaffNote(`אי אפשר להדפיס ניסיון: ${dymo.message}`);
      return;
    }
    setTesting(true);
    try {
      await printLabel("בדיקה", "הייטקורס", dymo.printer!, labelKey);
      setStaffNote(`נשלח ל-${dymo.printer}. אם לא יצאה מדבקה - בדקי את תור ההדפסה של המדפסת ב-Windows.`);
    } catch (e) {
      setStaffNote(e instanceof Error ? e.message : "שגיאה בהדפסת הניסיון");
    } finally {
      setTesting(false);
    }
  };
  const leave = async () => {
    await api("leave", { method: "POST" }).catch(() => null);
    router.refresh();
  };

  const canSearch = digits.length >= MIN_DIGITS && step.kind !== "searching" && step.kind !== "printing";
  const cells = Array.from({ length: MAX_DIGITS }, (_, i) => digits[i] ?? "");

  const pill = (
    <div className="pill" data-testid="tags-kiosk-printer" data-ready={printerReady ? "1" : "0"} title={dymo.message}>
      <span className="dot" />
      {printerReady ? "המדפסת מוכנה" : dymo.message === "מאתחל..." ? "בודקת את המדפסת..." : "המדפסת לא מחוברת - פני לדלפק"}
    </div>
  );

  return (
    <Frame fontClass={fontClass} build={build} pill={pill} onStaff={() => setStaffOpen(true)}>
      <main className="body" data-testid="tags-kiosk" data-step={step.kind} onPointerDown={touch}>
        <section className="col entry">
          <div className="step">
            <span className="num">1</span>
            הקלידי את מספר תעודת הזהות שלך
          </div>
          <div className="digits" data-testid="tags-kiosk-digits" data-value={digits} aria-label={`מספר תעודת זהות: ${digits}`}>
            {cells.map((c, i) => (
              <span key={i} className={`cell${c ? " on" : i === digits.length ? " cursor" : ""}`}>
                {c}
              </span>
            ))}
          </div>
          <Keypad onDigit={addDigit} onBack={back} onClear={reset} disabled={step.kind === "searching" || step.kind === "printing"} />
          <button type="button" className="btn primary" onClick={() => void search()} disabled={!canSearch} data-testid="tags-kiosk-search">
            {step.kind === "searching" ? "מחפשת..." : "חיפוש"}
          </button>
        </section>

        <section className="col result">
          <div className="step">
            <span className="num">2</span>
            אישור והדפסה
          </div>
          {step.kind === "idle" && (
            <div className="card" data-testid="tags-kiosk-empty">
              <IdCard size={120} strokeWidth={1.4} className="empty" />
              <p className="p">אחרי החיפוש הפרטים שלך יופיעו כאן, ובלחיצה אחת התג מודפס.</p>
            </div>
          )}
          {step.kind === "searching" && (
            <div className="card" data-testid="tags-kiosk-searching">
              <div className="spin" />
              <p className="p">מחפשת אותך ברשימה...</p>
            </div>
          )}
          {step.kind === "found" && (
            <div className="card found" data-testid="tags-kiosk-found" data-tz={step.p.cols["ת.ז."] ?? ""}>
              <div className="hello">שלום,</div>
              <div className="name" data-testid="tags-kiosk-name">
                {tagNameOf(step.p)}
              </div>
              {officeOf(step.p) && <div className="office">{officeOf(step.p)}</div>}
              {(step.p.cols["תפקיד"] || step.p.cols["קורס"]) && (
                <div className="chips">
                  {step.p.cols["תפקיד"] && <span className="chip">{step.p.cols["תפקיד"]}</span>}
                  {step.p.cols["קורס"] && <span className="chip">{step.p.cols["קורס"]}</span>}
                </div>
              )}
              {step.p.cols["הודפס"] === "כן" && (
                <div className="note" data-testid="tags-kiosk-printed-note">
                  התג שלך כבר הודפס{step.p.cols["תאריך ושעת ההדפסה"] ? ` (${step.p.cols["תאריך ושעת ההדפסה"]})` : ""}. אם הוא לא אצלך - אפשר להדפיס שוב.
                </div>
              )}
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => void print()} disabled={!printerReady} data-testid="tags-kiosk-print">
                  <Printer size={40} />
                  הדפסת התג שלי
                </button>
                <button type="button" className="btn ghost" onClick={reset} data-testid="tags-kiosk-notme">
                  זו לא אני
                </button>
              </div>
            </div>
          )}
          {step.kind === "printing" && (
            <div className="card found" data-testid="tags-kiosk-printing">
              <div className="spin" />
              <div className="h1">מדפיסה את התג...</div>
              <p className="p">עוד רגע הוא יוצא מהמדפסת.</p>
            </div>
          )}
          {step.kind === "done" && (
            <div className="card done" data-testid="tags-kiosk-done">
              <CircleCheckBig size={120} strokeWidth={1.6} style={{ color: "#3DBB7A" }} />
              <div className="h1">התג שלך מוכן!</div>
              <p className="p">
                קחי אותו מהמדפסת שלידך. <b>יום נעים, {tagNameOf(step.p)}.</b>
              </p>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={reset} data-testid="tags-kiosk-finish">
                  סיום
                </button>
              </div>
            </div>
          )}
          {step.kind === "notfound" && (
            <div className="card bad" data-testid="tags-kiosk-notfound">
              <SearchX size={110} strokeWidth={1.5} style={{ color: "#FF7366" }} />
              <div className="h1">לא מצאנו את המספר</div>
              <div className="big-tz">{step.tz}</div>
              <p className="p">
                בדקי שהקלדת נכון ונסי שוב. אם המספר נכון - <b>פני לדלפק הרישום</b> ושם ידפיסו לך תג.
              </p>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep({ kind: "idle" })} data-testid="tags-kiosk-retry">
                  לתקן ולנסות שוב
                </button>
              </div>
            </div>
          )}
          {step.kind === "error" && (
            <div className="card bad" data-testid="tags-kiosk-error">
              <TriangleAlert size={110} strokeWidth={1.5} style={{ color: "#FF7366" }} />
              <div className="h1">משהו לא עבד</div>
              <p className="p">
                {step.message} <b>פני לדלפק הרישום</b> - שם יעזרו לך.
              </p>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={reset} data-testid="tags-kiosk-retry">
                  להתחיל מחדש
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {staffOpen && (
        <div className="staff" data-testid="tags-kiosk-staff-panel" onPointerDown={touch}>
          <div className="staff-card" dir="rtl">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>הגדרות לצוות</h2>
              <button type="button" className="sb light" onClick={() => setStaffOpen(false)} data-testid="tags-kiosk-staff-close">
                <X size={22} />
                סגירה
              </button>
            </div>
            <div className="row">
              <b>מדפסת:</b>
              <span style={{ color: printerReady ? "#1E7F4F" : "#C0392B", fontWeight: 700 }} data-testid="tags-kiosk-staff-status" data-ready={printerReady ? "1" : "0"}>
                {dymo.message}
              </span>
              <button type="button" className="sb light" onClick={() => void checkPrinter()} disabled={checking} data-testid="tags-kiosk-check">
                {checking ? "בודקת..." : "בדיקה"}
              </button>
            </div>
            {dymo.printers.length > 0 && (
              <div className="row">
                <label htmlFor="kiosk-printer">להדפיס על:</label>
                <select id="kiosk-printer" value={dymo.printer ?? ""} onChange={(e) => pickPrinter(e.target.value)} data-testid="tags-kiosk-printer-pick">
                  {dymo.printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                      {p.connected ? "" : " (לא מחוברת)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="row">
              <label htmlFor="kiosk-label">מדבקה:</label>
              <select id="kiosk-label" value={labelKey} onChange={(e) => pickLabel(e.target.value as LabelKey)} data-testid="tags-kiosk-label">
                {(Object.keys(LABELS) as LabelKey[]).map((k) => (
                  <option key={k} value={k}>
                    {LABELS[k].label}
                  </option>
                ))}
              </select>
              <button type="button" className="sb" onClick={() => void testPrint()} disabled={testing} data-testid="tags-kiosk-test-print">
                <Printer size={20} />
                {testing ? "מדפיסה..." : "הדפסת ניסיון"}
              </button>
            </div>
            {staffNote && (
              <p className="muted" style={{ fontSize: 19, color: "#1C2B3A" }} data-testid="tags-kiosk-staff-note">
                {staffNote}
              </p>
            )}
            {!printerReady && dymo.message !== "מאתחל..." && (
              <div className="help" data-testid="tags-kiosk-help">
                <b>המדפסת לא מוכנה במחשב הזה.</b> המסך מדפיס דרך שירות DYMO שמותקן במחשב שאליו המדפסת מחוברת:
                <ol>
                  <li>המדפסת מחוברת ב-USB למחשב הזה ודולקת, וב-Windows → מדפסות היא לא Offline.</li>
                  <li>תוכנת DYMO מותקנת ושירות DYMO Web Service רץ (אייקון ליד השעון).</li>
                  <li>
                    פתחי פעם אחת בלשונית חדשה{" "}
                    <a href={`${DYMO_SERVICE_URL}/Check`} target="_blank" rel="noreferrer" dir="ltr">
                      {DYMO_SERVICE_URL}/Check
                    </a>
                    , אשרי את אזהרת האבטחה, ואז ״בדיקה״.
                  </li>
                </ol>
              </div>
            )}
            {dymo.detail && (
              <details data-testid="tags-kiosk-detail">
                <summary className="muted" style={{ cursor: "pointer" }}>
                  פרטים טכניים - מה DYMO ענה
                </summary>
                <pre>{dymo.detail}</pre>
              </details>
            )}
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span className="muted">
                <a href="/tags">לדלפק המלא (חיפוש לפי שם, הוספת משתתפת)</a> · גרסה {build}
              </span>
              <button type="button" className="sb light" onClick={() => void leave()} data-testid="tags-kiosk-leave">
                יציאה מהמסך במחשב הזה
              </button>
            </div>
          </div>
        </div>
      )}
    </Frame>
  );
}

export function TagsKiosk({ mode, build, fontClass }: { mode: KioskMode; build: string; fontClass: string }) {
  if (mode === "ready") return <KioskReady fontClass={fontClass} build={build} />;
  if (mode === "enter") return <KioskGate fontClass={fontClass} build={build} />;
  return <KioskNotice fontClass={fontClass} build={build} mode={mode} />;
}
