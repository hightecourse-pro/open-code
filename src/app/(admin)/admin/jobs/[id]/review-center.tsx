"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  addJobCandidate,
  setApplicationMark,
  updateApplicationPipeline,
} from "@/app/(admin)/admin/actions";
import type { AdminMark, PipelineStatus } from "@/app/(admin)/admin/actions";

// ----------------------------------------------------------------- data types

export interface ReviewQuestion {
  id: string;
  question: string;
}

export interface ReviewProfileSummary {
  fullName: string;
  specialization: string | null;
  region: string | null;
  isExperienced: boolean;
}

export interface ReviewApplication {
  id: string;
  applicantId: string;
  submittedAt: string;
  status: string;
  adminMark: AdminMark | null;
  /** Her private "why not fit" note — rides only with a not_fit mark. */
  adminMarkReason: string | null;
  sentToClientAt: string | null;
  /**
   * {questionId: answer} + the built-in "fit" answer — parsed server-side.
   * Values follow the question's answer type: string (paragraph/select),
   * number (number) or string[] (multiselect).
   */
  answers: Record<string, string | number | string[]>;
  /** Signed URL (1h) for her application CV, else her latest CV. */
  cvUrl: string | null;
  profile: ReviewProfileSummary | null;
  curated: boolean;
  clientFeedback: { interviewMarked: boolean; clientNote: string | null } | null;
  /** מנויה (profiles.status === "active") — internal indication only. */
  isSubscriber: boolean;
  /** VIP from the admin-only member_crm — internal indication only. */
  isVip: boolean;
}

// -------------------------------------------------------------------- labels

const FIT_QUESTION = "למה את חושבת שאת מתאימה למשרה?";

const MARK_LABEL: Record<AdminMark, string> = {
  optional: "אופציונלית",
  not_fit: "לא מתאימה",
  approved: "אישור סופי",
};

const MARK_CHIP: Record<AdminMark, string> = {
  optional: "bg-tint-warm text-[#8C5E0E] border border-[#F0DCA8]",
  not_fit: "bg-danger-bg text-[#A8254B] border border-[#F2BBC8]",
  approved: "bg-tint-mint text-[#0F6E4A] border border-[#BFE4D1]",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  submitted: "הוגשה",
  in_review: "בבדיקה",
  accepted: "אושרה",
  rejected: "נדחתה",
  sent: "הוגשה ללקוח",
  interview: "ראיון",
  exam: "מבחן",
  hired: "גויסה 🎉",
  declined: "בפעם הבאה",
};

const PIPELINE_OPTIONS: { value: PipelineStatus; label: string }[] = [
  { value: "interview", label: "ראיון" },
  { value: "exam", label: "מבחן" },
  { value: "hired", label: "גויסה" },
  { value: "declined", label: "בפעם הבאה" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

/** jsonb answer → display text: arrays join with a middot, numbers stringify. */
function answerText(v: string | number | string[]): string {
  return Array.isArray(v) ? v.join(" · ") : String(v);
}

// --------------------------------------------------------------------- tiles

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={cn("rounded-[14px] border px-3 py-2.5 text-center", className)}>
      <div className="font-display text-xl font-black leading-none">{value}</div>
      <div className="mt-1 text-[11.5px] font-semibold">{label}</div>
    </div>
  );
}

/** ⭐ (VIP) + "מנויה" pill — internal indications, admin-only surface. */
function MemberFlair({ app, starClass }: { app: ReviewApplication; starClass?: string }) {
  return (
    <>
      {app.isVip && (
        <span title="VIP — עדיפות בהשמות" className={cn("shrink-0 text-[13px]", starClass)}>
          ⭐
        </span>
      )}
      {app.isSubscriber && (
        <span className="shrink-0 rounded-full bg-tint-pink px-1.5 py-0.5 text-[10px] font-bold text-brand-pink-deep">
          מנויה
        </span>
      )}
    </>
  );
}

// ----------------------------------------------------------------- component

/**
 * The admin review center for a job's applications: dashboard counts, a
 * filterable list, and a detail pane with the applicant's answers, CV, the
 * internal review mark and the client-pipeline status. Marks are optimistic —
 * the server (revalidate) is the source of truth on the next load.
 */
export function ReviewCenter({
  jobId,
  applications,
  questions,
}: {
  jobId: string;
  applications: ReviewApplication[];
  questions: ReviewQuestion[];
}) {
  const [query, setQuery] = useState("");
  const [markFilter, setMarkFilter] = useState<"all" | "none" | AdminMark>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // "בלי הלא רלוונטיות שכבר בדקתי" — not_fit rows are hidden by default.
  const [showNotFit, setShowNotFit] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(applications[0]?.id ?? null);

  // Optimistic overrides on top of the server-rendered props.
  const [marks, setMarks] = useState<Record<string, AdminMark | null>>({});
  const [reasons, setReasons] = useState<Record<string, string | null>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [curatedLocal, setCuratedLocal] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  // The inline "why not fit" box — open for at most one application at a time.
  const [reasonEditor, setReasonEditor] = useState<{ id: string; draft: string } | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const markOf = useCallback(
    (a: ReviewApplication): AdminMark | null => (a.id in marks ? marks[a.id] : a.adminMark),
    [marks]
  );
  const reasonOf = useCallback(
    (a: ReviewApplication): string | null =>
      a.id in reasons ? reasons[a.id] : a.adminMarkReason,
    [reasons]
  );
  const statusOf = useCallback(
    (a: ReviewApplication): string => statuses[a.id] ?? a.status,
    [statuses]
  );
  const isCurated = (a: ReviewApplication): boolean =>
    a.curated || curatedLocal.has(a.applicantId);

  // Dashboard counts follow the optimistic state so the strip reacts instantly.
  const counts = useMemo(() => {
    let optional = 0;
    let notFit = 0;
    let approved = 0;
    let sentToClient = 0;
    for (const a of applications) {
      const m = markOf(a);
      if (m === "optional") optional++;
      else if (m === "not_fit") notFit++;
      else if (m === "approved") approved++;
      if (a.sentToClientAt || statusOf(a) === "sent") sentToClient++;
    }
    return {
      total: applications.length,
      reviewed: optional + notFit + approved, // "נבדקה" = has any admin mark
      optional,
      notFit,
      approved,
      sentToClient,
    };
  }, [applications, markOf, statusOf]);

  // Explicitly filtering by "לא מתאימות" is a request to see them — don't let
  // the default hide turn that filter into an empty list.
  const notFitVisible = showNotFit || markFilter === "not_fit";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = applications.filter((a) => {
      if (q && !(a.profile?.fullName ?? "").toLowerCase().includes(q)) return false;
      const m = markOf(a);
      if (m === "not_fit" && !notFitVisible) return false;
      if (markFilter === "none" && m !== null) return false;
      if (markFilter !== "all" && markFilter !== "none" && m !== markFilter) return false;
      if (statusFilter !== "all" && statusOf(a) !== statusFilter) return false;
      return true;
    });
    // VIPs first; sort is stable, so the existing (newest-first) order holds
    // within each group.
    return list.sort((a, b) => Number(b.isVip) - Number(a.isVip));
  }, [applications, query, markFilter, statusFilter, notFitVisible, markOf, statusOf]);

  // Keep a valid selection even when the filters drop the selected row.
  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;
  const selectedIndex = selected ? filtered.findIndex((a) => a.id === selected.id) : -1;

  function applyMark(app: ReviewApplication, m: AdminMark) {
    const current = markOf(app);
    if (m === "not_fit" && current !== "not_fit") {
      // "לא מתאימה" first asks (optionally) why — the save happens from the box.
      setActionError(null);
      setReasonEditor({ id: app.id, draft: reasonOf(app) ?? "" });
      return;
    }
    const next = current === m ? null : m; // clicking the active mark clears it
    const prevReason = reasonOf(app);
    setActionError(null);
    if (reasonEditor?.id === app.id) setReasonEditor(null);
    setMarks((prev) => ({ ...prev, [app.id]: next }));
    // Any save that isn't not_fit clears the reason server-side — mirror it.
    setReasons((prev) => ({ ...prev, [app.id]: null }));
    startTransition(async () => {
      const res = await setApplicationMark(app.id, next);
      if (res?.error) {
        setMarks((prev) => ({ ...prev, [app.id]: current }));
        setReasons((prev) => ({ ...prev, [app.id]: prevReason }));
        setActionError(res.error);
      }
    });
  }

  /** Save not_fit with an optional reason (from the inline box). */
  function saveNotFit(app: ReviewApplication, reason: string | null) {
    const prevMark = markOf(app);
    const prevReason = reasonOf(app);
    const clean = (reason ?? "").trim().slice(0, 500) || null;
    setActionError(null);
    setReasonEditor(null);
    setMarks((prev) => ({ ...prev, [app.id]: "not_fit" }));
    setReasons((prev) => ({ ...prev, [app.id]: clean }));
    // The row is about to disappear from the default view — move the detail
    // pane to the next visible applicant (or the previous one, or none).
    if (!notFitVisible && selected?.id === app.id) {
      const idx = filtered.findIndex((x) => x.id === app.id);
      setSelectedId(filtered[idx + 1]?.id ?? filtered[idx - 1]?.id ?? null);
    }
    startTransition(async () => {
      const res = await setApplicationMark(app.id, "not_fit", clean);
      if (res?.error) {
        setMarks((prev) => ({ ...prev, [app.id]: prevMark }));
        setReasons((prev) => ({ ...prev, [app.id]: prevReason }));
        setActionError(res.error);
      }
    });
  }

  function applyPipeline(app: ReviewApplication, value: PipelineStatus) {
    const current = statusOf(app);
    setActionError(null);
    setStatuses((prev) => ({ ...prev, [app.id]: value }));
    startTransition(async () => {
      const res = await updateApplicationPipeline(app.id, value);
      if (res?.error) {
        setStatuses((prev) => ({ ...prev, [app.id]: current }));
        setActionError(res.error);
      }
    });
  }

  function addToPortal(app: ReviewApplication) {
    setActionError(null);
    setBusy(true);
    setCuratedLocal((prev) => new Set(prev).add(app.applicantId));
    startTransition(async () => {
      try {
        await addJobCandidate(jobId, app.applicantId);
      } catch {
        setCuratedLocal((prev) => {
          const next = new Set(prev);
          next.delete(app.applicantId);
          return next;
        });
        setActionError("ההוספה למשרה נכשלה. נסי שוב.");
      } finally {
        setBusy(false);
      }
    });
  }

  if (applications.length === 0) {
    return <p className="text-ink-500 text-sm py-2">אין הגשות למשרה הזו עדיין.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------- dashboard strip */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-bold text-ink-900 whitespace-nowrap">
            נבדקו {counts.reviewed} מתוך {counts.total}
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-ink-100 overflow-hidden" aria-hidden>
            <div
              className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
              style={{
                width: `${counts.total ? Math.round((counts.reviewed / counts.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat
            label="הגישו"
            value={counts.total}
            className="border-ink-200 bg-ink-0 text-ink-900"
          />
          <Stat
            label="אופציונליות"
            value={counts.optional}
            className="border-[#F0DCA8] bg-tint-warm text-[#8C5E0E]"
          />
          <Stat
            label="לא מתאימות"
            value={counts.notFit}
            className="border-[#F2BBC8] bg-danger-bg text-[#A8254B]"
          />
          <Stat
            label="אושרו סופית"
            value={counts.approved}
            className="border-[#BFE4D1] bg-tint-mint text-[#0F6E4A]"
          />
          <Stat
            label="הוגשו ללקוח"
            value={counts.sentToClient}
            className="border-[#DDC9EC] bg-tint-purple text-brand-purple"
          />
        </div>
      </div>

      {/* --------------------------------------------------------- filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={15}
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400 pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם…"
            className="ps-9 py-2"
            aria-label="חיפוש מועמדת לפי שם"
          />
        </div>
        <Select
          value={markFilter}
          onChange={(e) => setMarkFilter(e.target.value as typeof markFilter)}
          className="w-auto min-w-[140px] py-2"
          aria-label="סינון לפי סימון פנימי"
        >
          <option value="all">כל הסימונים</option>
          <option value="none">ללא סימון</option>
          <option value="optional">אופציונליות</option>
          <option value="not_fit">לא מתאימות</option>
          <option value="approved">אישור סופי</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto min-w-[140px] py-2"
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">כל הסטטוסים</option>
          {["submitted", "in_review", "sent", "interview", "exam", "hired", "declined"].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Checkbox
          checked={showNotFit}
          onChange={(e) => setShowNotFit(e.target.checked)}
          label={
            <span className="text-[12.5px] text-ink-700">
              הצגת לא רלוונטיות ({counts.notFit})
            </span>
          }
        />
      </div>

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {/* ------------------------------------------------- list + detail */}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
        {/* list */}
        <div className="flex flex-col max-h-[560px] overflow-y-auto rounded-[14px] border border-ink-200 bg-ink-0">
          {filtered.length === 0 && (
            <p className="text-ink-500 text-sm px-3 py-4">אין מועמדות שתואמות את הסינון.</p>
          )}
          {filtered.map((a) => {
            const active = selected?.id === a.id;
            const mark = markOf(a);
            const status = statusOf(a);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex flex-col items-stretch gap-1 border-b border-ink-100 px-3 py-2.5 text-start transition-colors last:border-b-0",
                  active ? "bg-tint-purple" : "hover:bg-ink-50"
                )}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-ink-900 text-sm truncate">
                    {a.profile?.fullName ?? "מועמדת"}
                  </span>
                  <MemberFlair app={a} starClass="text-[12px]" />
                </span>
                <span className="text-[11.5px] text-ink-500 truncate">
                  {a.profile?.specialization ?? "—"} · {fmtDate(a.submittedAt)}
                </span>
                <span className="flex flex-wrap gap-1">
                  {mark && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                        MARK_CHIP[mark]
                      )}
                    >
                      {MARK_LABEL[mark]}
                    </span>
                  )}
                  {status !== "submitted" && (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-700">
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  )}
                  {a.clientFeedback?.interviewMarked && (
                    <span className="rounded-full bg-tint-warm px-2 py-0.5 text-[10.5px] font-bold text-crown-gold border border-crown-gold-soft">
                      ⭐ לראיון
                    </span>
                  )}
                </span>
                {mark === "not_fit" && reasonOf(a) && (
                  <span className="text-[11px] text-ink-400 truncate">
                    הסיבה שלך: {reasonOf(a)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* detail pane */}
        {selected ? (
          <div className="rounded-[14px] border border-ink-200 bg-ink-0 p-4 flex flex-col gap-4">
            {/* header + prev/next */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h4 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-1.5 flex-wrap">
                  {selected.profile?.fullName ?? "מועמדת"}
                  <MemberFlair app={selected} starClass="text-[15px]" />
                </h4>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {selected.profile?.specialization && (
                    <Badge variant="purple">{selected.profile.specialization}</Badge>
                  )}
                  {selected.profile?.region && (
                    <Badge variant="indigo">{selected.profile.region}</Badge>
                  )}
                  {selected.profile?.isExperienced && <Badge variant="mint">בעלת ניסיון</Badge>}
                  {(selected.sentToClientAt || statusOf(selected) === "sent") && (
                    <Badge variant="pink">הוגשה ללקוח</Badge>
                  )}
                </div>
                <p className="text-[12px] text-ink-500 mt-1.5">
                  הגישה ב־{fmtDate(selected.submittedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="מעבר בין מועמדות">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedId(filtered[selectedIndex - 1]?.id ?? null)}
                >
                  <ChevronRight size={14} /> הקודמת
                </Button>
                <span className="text-[12px] text-ink-500 tabular-nums" dir="ltr">
                  {selectedIndex + 1}/{filtered.length}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={selectedIndex >= filtered.length - 1}
                  onClick={() => setSelectedId(filtered[selectedIndex + 1]?.id ?? null)}
                >
                  הבאה <ChevronLeft size={14} />
                </Button>
              </div>
            </div>

            {/* client feedback (from the portal) */}
            {selected.clientFeedback &&
              (selected.clientFeedback.interviewMarked || selected.clientFeedback.clientNote) && (
                <div className="flex flex-col gap-1.5">
                  {selected.clientFeedback.interviewMarked && (
                    <Badge variant="warm" className="w-fit">
                      הלקוח מסמן לראיון ⭐
                    </Badge>
                  )}
                  {selected.clientFeedback.clientNote && (
                    <p className="text-[13px] text-ink-700 bg-tint-purple rounded-md px-3 py-2">
                      <b>הערת הלקוח:</b> {selected.clientFeedback.clientNote}
                    </p>
                  )}
                </div>
              )}

            {/* internal mark */}
            <div>
              <div className="text-[12px] font-bold text-ink-700 mb-1.5">
                סימון פנימי (לא נחשף ללקוח או למועמדת)
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MARK_LABEL) as AdminMark[]).map((m) => {
                  const active = markOf(selected) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyMark(selected, m)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                        active
                          ? MARK_CHIP[m]
                          : "border-ink-200 bg-ink-0 text-ink-500 hover:text-ink-900 hover:border-ink-400"
                      )}
                    >
                      {MARK_LABEL[m]}
                    </button>
                  );
                })}
              </div>

              {/* the inline "why not fit" box — optional, admin-only */}
              {reasonEditor?.id === selected.id ? (
                <div className="mt-2 flex flex-col gap-2 rounded-[12px] border border-ink-200 bg-ink-50 p-3">
                  <Textarea
                    value={reasonEditor.draft}
                    onChange={(e) => setReasonEditor({ id: selected.id, draft: e.target.value })}
                    placeholder="למה לא מתאימה? (אופציונלי, רק לך)"
                    aria-label="סיבת אי-ההתאמה (פנימי, אופציונלי)"
                    maxLength={500}
                    rows={2}
                    autoFocus
                    className="min-h-16 bg-ink-0 text-[13px]"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveNotFit(selected, reasonEditor.draft)}
                    >
                      שמירה
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => saveNotFit(selected, null)}
                    >
                      בלי סיבה
                    </Button>
                  </div>
                </div>
              ) : (
                markOf(selected) === "not_fit" && (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px] text-ink-500">
                    {reasonOf(selected) && <span>הסיבה שלך: {reasonOf(selected)}</span>}
                    <button
                      type="button"
                      className="font-semibold text-brand-purple hover:underline"
                      onClick={() =>
                        setReasonEditor({ id: selected.id, draft: reasonOf(selected) ?? "" })
                      }
                    >
                      {reasonOf(selected) ? "עריכת הסיבה" : "הוספת סיבה"}
                    </button>
                  </div>
                )
              )}
            </div>

            {/* pipeline status */}
            <div>
              <div className="text-[12px] font-bold text-ink-700 mb-1.5">
                סטטוס מול הלקוח — עדכון שולח לה מייל
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={
                    PIPELINE_OPTIONS.some((o) => o.value === statusOf(selected))
                      ? statusOf(selected)
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value as PipelineStatus | "";
                    if (v) applyPipeline(selected, v);
                  }}
                  className="w-auto min-w-[150px] py-2"
                  aria-label="עדכון סטטוס בצינור הגיוס"
                >
                  <option value="" disabled>
                    בחרי שלב…
                  </option>
                  {PIPELINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <span className="text-[12.5px] text-ink-500">
                  סטטוס נוכחי:{" "}
                  <b className="text-ink-900">
                    {STATUS_LABEL[statusOf(selected)] ?? statusOf(selected)}
                  </b>
                </span>
              </div>
            </div>

            {/* CV + curation */}
            <div className="flex flex-wrap items-center gap-3">
              {selected.cvUrl ? (
                <a
                  href={selected.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline"
                >
                  <FileText size={15} /> צפייה בקורות החיים
                  <ExternalLink size={12} aria-hidden />
                </a>
              ) : (
                <span className="text-sm text-ink-500">אין קובץ קורות חיים.</span>
              )}
              {isCurated(selected) ? (
                <Badge variant="mint">נבחרה למשרה בפורטל ✓</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => addToPortal(selected)}
                >
                  <Plus size={13} /> הוספה למשרה בפורטל
                </Button>
              )}
            </div>

            {/* answers */}
            <div className="flex flex-col gap-2">
              <div className="text-[12px] font-bold text-ink-700">התשובות שלה</div>
              {(() => {
                const qa: { label: string; answer: string }[] = [];
                if (selected.answers.fit !== undefined) {
                  qa.push({ label: FIT_QUESTION, answer: answerText(selected.answers.fit) });
                }
                for (const q of questions) {
                  const ans = selected.answers[q.id];
                  if (ans !== undefined) qa.push({ label: q.question, answer: answerText(ans) });
                }
                const known = new Set(["fit", ...questions.map((q) => q.id)]);
                for (const [k, v] of Object.entries(selected.answers)) {
                  if (!known.has(k))
                    qa.push({ label: "שאלה נוספת (הוסרה מהמשרה)", answer: answerText(v) });
                }
                if (qa.length === 0) {
                  return (
                    <p className="text-sm text-ink-500">אין תשובות להגשה הזו (הגשה ישנה).</p>
                  );
                }
                return qa.map((item, i) => (
                  <div key={i} className="rounded-md bg-ink-50 border border-ink-100 px-3.5 py-3">
                    <div className="text-[12px] font-bold text-brand-purple mb-1">{item.label}</div>
                    <div className="text-[13.5px] text-ink-900 whitespace-pre-wrap leading-relaxed">
                      {item.answer}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        ) : (
          <p className="text-ink-500 text-sm rounded-[14px] border border-dashed border-ink-200 px-4 py-10 text-center">
            בחרי מועמדת מהרשימה כדי לראות את הפרטים שלה.
          </p>
        )}
      </div>
    </div>
  );
}
