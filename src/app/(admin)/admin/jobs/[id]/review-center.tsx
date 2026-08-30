"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  List,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  addJobCandidate,
  setApplicationMark,
  setApplicationMarkBulk,
  setApplicationNote,
  updateApplicationPipeline,
} from "@/app/(admin)/admin/actions";
import type { AdminMark, PipelineStatus } from "@/app/(admin)/admin/actions";
import type { AudienceCatalogueField } from "@/lib/admin/audience";

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
  /** The team's general internal note about her (member_crm) — admin-only. */
  crmNote: string | null;
  /** Note tied to HER × THIS JOB (application_notes) — the table's הערה column. */
  adminNote: string | null;
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
  waitlisted: "התקדמנו בינתיים",
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

function Stat({
  label,
  value,
  className,
  active,
  onClick,
}: {
  label: string;
  value: number;
  className: string;
  /** Is this tile's filter currently applied? */
  active?: boolean;
  /** Tiles double as filters — clicking applies, clicking again clears. */
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? "ביטול הסינון" : `סינון לפי ${label}`}
      className={cn(
        "rounded-[14px] border px-3 py-2.5 text-center cursor-pointer transition-shadow",
        "hover:shadow-md focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(224,65,141,0.2)]",
        active && "shadow-[0_0_0_2.5px_rgba(224,65,141,0.45)]",
        className
      )}
    >
      <div className="font-display text-xl font-black leading-none">{value}</div>
      <div className="mt-1 text-[11.5px] font-semibold">{label}</div>
    </button>
  );
}

/**
 * Inline editor for the per-application note (the owner's הערה column).
 * Saves on blur / Enter; the optimistic value lives with the parent so the
 * cell survives re-sorts and filter changes.
 */
function NoteCell({
  appId,
  value,
  onSaved,
  onError,
}: {
  appId: string;
  value: string | null;
  onSaved: (v: string | null) => void;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();

  function save() {
    const clean = draft.trim().slice(0, 500);
    if ((value ?? "") === clean) return;
    start(async () => {
      const res = await setApplicationNote(appId, clean);
      if (res?.error) onError(res.error);
      else onSaved(clean || null);
    });
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder="הערה עליה במשרה הזו…"
      aria-label="הערה פנימית על ההגשה"
      maxLength={500}
      className={cn(
        "w-full min-w-[150px] rounded-md border border-ink-200 bg-ink-0 px-2 py-1 text-[12px] text-ink-900",
        "outline-none focus:border-brand-purple placeholder:text-ink-300",
        pending && "opacity-60 animate-pulse"
      )}
    />
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
  jobTitle,
  teamNote,
  applications,
  questions,
  criteriaCatalogue,
  criteriaPools,
}: {
  jobId: string;
  jobTitle: string;
  /** The per-job internal note for whoever reviews applicants. */
  teamNote: string | null;
  applications: ReviewApplication[];
  questions: ReviewQuestion[];
  /** Profile-parameter palette scoped to the applicants (no dead chips). */
  criteriaCatalogue: AudienceCatalogueField[];
  /** profile id → question key → her values, label-resolved + lowercased. */
  criteriaPools: Record<string, Record<string, string[]>>;
}) {
  const [query, setQuery] = useState("");
  const [markFilter, setMarkFilter] = useState<"all" | "none" | AdminMark>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // מנויות / VIP one-click filters (Shira: clear counts + easy filtering).
  const [tierFilter, setTierFilter] = useState<"all" | "subscribers" | "vip">("all");
  // Profile-parameter criteria: question key → selected values. Selections
  // accumulate across parameters, like the publish panel.
  const [criteria, setCriteria] = useState<Record<string, string[]>>({});
  const [activeKey, setActiveKey] = useState(criteriaCatalogue[0]?.key ?? "");
  const [valueQuery, setValueQuery] = useState("");
  // "בלי הלא רלוונטיות שכבר בדקתי" — not_fit rows are hidden by default.
  const [showNotFit, setShowNotFit] = useState(false);
  const [view, setView] = useState<"list" | "table">("list");
  const [selectedId, setSelectedId] = useState<string | null>(applications[0]?.id ?? null);
  // Multi-select for the bulk-mark bar (application ids, visible rows only).
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [bulkReasonOpen, setBulkReasonOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");

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

  // Optimistic per-application notes (application_notes) — the הערה column.
  const [notes, setNotes] = useState<Record<string, string | null>>({});
  const noteValOf = useCallback(
    (a: ReviewApplication): string | null => (a.id in notes ? notes[a.id] : a.adminNote),
    [notes]
  );

  // Per-column filters for the table (the owner: "אופציה לסנן לפי כל עמודה").
  const [colFilters, setColFilters] = useState({
    name: "",
    spec: "",
    region: "",
    exp: "",
    status: "",
    mark: "",
    note: "",
  });
  const setCol = (key: keyof typeof colFilters) => (value: string) =>
    setColFilters((prev) => ({ ...prev, [key]: value }));

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
      subscribers: applications.filter((a) => a.isSubscriber).length,
      vips: applications.filter((a) => a.isVip).length,
    };
  }, [applications, markOf, statusOf]);

  // Explicitly filtering by "לא מתאימות" is a request to see them — don't let
  // the default hide turn that filter into an empty list.
  const notFitVisible = showNotFit || markFilter === "not_fit";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // OR within one criterion, AND across criteria — same semantics as
    // previewAudience, matched against the lowercased applicant pools.
    const wanted = Object.entries(criteria)
      .map(([key, values]) => ({
        key,
        values: values.filter(Boolean).map((v) => v.trim().toLowerCase()),
      }))
      .filter((c) => c.values.length > 0);
    const list = applications.filter((a) => {
      if (q && !(a.profile?.fullName ?? "").toLowerCase().includes(q)) return false;
      const m = markOf(a);
      if (m === "not_fit" && !notFitVisible) return false;
      if (markFilter === "none" && m !== null) return false;
      if (markFilter !== "all" && markFilter !== "none" && m !== markFilter) return false;
      if (statusFilter !== "all" && statusOf(a) !== statusFilter) return false;
      if (tierFilter === "subscribers" && !a.isSubscriber) return false;
      if (tierFilter === "vip" && !a.isVip) return false;
      if (wanted.length > 0) {
        const mine = criteriaPools[a.applicantId] ?? {};
        for (const c of wanted) {
          const have = mine[c.key] ?? [];
          if (!c.values.some((v) => have.includes(v))) return false;
        }
      }
      return true;
    });
    // VIPs first; sort is stable, so the existing (newest-first) order holds
    // within each group.
    return list.sort((a, b) => Number(b.isVip) - Number(a.isVip));
  }, [
    applications,
    query,
    criteria,
    criteriaPools,
    markFilter,
    statusFilter,
    tierFilter,
    notFitVisible,
    markOf,
    statusOf,
  ]);

  // The effective selection is only ever the visible rows — a filter change
  // narrows it (derived, no state pruning) and the bulk bar follows it.
  const visibleSelection = useMemo(() => {
    if (selection.size === 0) return selection;
    const next = new Set<string>();
    for (const a of filtered) if (selection.has(a.id)) next.add(a.id);
    return next;
  }, [selection, filtered]);

  // ------------------------------------------------ table per-column filters

  // The select options offer only values present among the (globally)
  // filtered rows — no dead choices.
  const colOptions = useMemo(() => {
    const specs = new Set<string>();
    const regions = new Set<string>();
    const statuses2 = new Set<string>();
    const marks2 = new Set<string>();
    for (const a of filtered) {
      if (a.profile?.specialization) specs.add(a.profile.specialization);
      if (a.profile?.region) regions.add(a.profile.region);
      statuses2.add(statusOf(a));
      const m = markOf(a);
      marks2.add(m ?? "none");
    }
    const heSort = (x: string, y: string) => x.localeCompare(y, "he");
    return {
      specs: [...specs].sort(heSort),
      regions: [...regions].sort(heSort),
      statuses: [...statuses2],
      marks: [...marks2],
    };
  }, [filtered, statusOf, markOf]);

  const tableRows = useMemo(() => {
    const nameQ = colFilters.name.trim().toLowerCase();
    const noteQ = colFilters.note.trim().toLowerCase();
    return filtered.filter((a) => {
      if (nameQ && !(a.profile?.fullName ?? "").toLowerCase().includes(nameQ)) return false;
      if (colFilters.spec && (a.profile?.specialization ?? "") !== colFilters.spec) return false;
      if (colFilters.region && (a.profile?.region ?? "") !== colFilters.region) return false;
      if (colFilters.exp === "yes" && !a.profile?.isExperienced) return false;
      if (colFilters.exp === "no" && a.profile?.isExperienced) return false;
      if (colFilters.status && statusOf(a) !== colFilters.status) return false;
      if (colFilters.mark && (markOf(a) ?? "none") !== colFilters.mark) return false;
      if (noteQ && !(noteValOf(a) ?? "").toLowerCase().includes(noteQ)) return false;
      return true;
    });
  }, [filtered, colFilters, statusOf, markOf, noteValOf]);

  const anyColFilter = Object.values(colFilters).some((v) => v !== "");

  // --------------------------------------------------- criteria bar helpers

  const activeField = criteriaCatalogue.find((f) => f.key === activeKey) ?? null;

  const visibleValues = useMemo(() => {
    if (!activeField) return [];
    const q = valueQuery.trim().toLowerCase();
    return q
      ? activeField.values.filter((v) => v.toLowerCase().includes(q))
      : activeField.values;
  }, [activeField, valueQuery]);

  // The active-filter chips row — every selected value across all parameters.
  const criteriaChips = useMemo(
    () =>
      Object.entries(criteria).flatMap(([key, values]) =>
        values.map((value) => ({
          key,
          value,
          label: criteriaCatalogue.find((f) => f.key === key)?.label ?? key,
        }))
      ),
    [criteriaCatalogue, criteria]
  );

  function toggleCriterion(key: string, value: string) {
    setCriteria((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const out = { ...prev };
      if (next.length) out[key] = next;
      else delete out[key]; // drop empty keys — they don't filter
      return out;
    });
  }

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

  // ------------------------------------------------- bulk selection + marks

  function toggleSelected(id: string, on: boolean) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allVisibleSelected =
    filtered.length > 0 && visibleSelection.size === filtered.length;

  function toggleSelectAll(on: boolean) {
    setSelection(on ? new Set(filtered.map((a) => a.id)) : new Set());
  }

  function clearSelection() {
    setSelection(new Set());
    setBulkReasonOpen(false);
    setBulkReason("");
  }

  /**
   * Apply one mark (or clear) to the whole selection — optimistic like the
   * single mark: rows, counts and the auto-hide of not_fit react instantly,
   * a failure rolls everything back (selection included) with an error.
   */
  function applyBulk(mark: AdminMark | null, reason?: string | null) {
    // The server caps a bulk at 200 rows — mirror it so the optimistic state
    // never claims more than what actually gets written.
    const ids = [...visibleSelection].slice(0, 200);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const prevMarks: Record<string, AdminMark | null> = {};
    const prevReasons: Record<string, string | null> = {};
    for (const a of applications) {
      if (!idSet.has(a.id)) continue;
      prevMarks[a.id] = markOf(a);
      prevReasons[a.id] = reasonOf(a);
    }
    // The reason rides only with not_fit — mirror the server's clearing.
    const clean = mark === "not_fit" ? (reason ?? "").trim().slice(0, 500) || null : null;
    setActionError(null);
    setBulkReasonOpen(false);
    setBulkReason("");
    if (reasonEditor && idSet.has(reasonEditor.id)) setReasonEditor(null);
    setMarks((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = mark;
      return next;
    });
    setReasons((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = clean;
      return next;
    });
    setSelection(new Set()); // cleared optimistically — restored on failure
    startTransition(async () => {
      const res = await setApplicationMarkBulk(ids, mark, clean);
      if (res?.error) {
        setMarks((prev) => ({ ...prev, ...prevMarks }));
        setReasons((prev) => ({ ...prev, ...prevReasons }));
        setSelection(new Set(ids));
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
        {/* The owner's four statuses (2026-08-30) — each tile filters AND
            opens the organized table; the מנויות/VIP counts live INSIDE
            "הגישו". The list view stays one click away on the toggle. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <div
            className={cn(
              "rounded-[14px] border px-3 py-2 text-center transition-shadow border-ink-200 bg-ink-0 text-ink-900",
              markFilter === "all" && statusFilter === "all" && tierFilter !== "all" && "shadow-[0_0_0_2.5px_rgba(224,65,141,0.25)]"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setMarkFilter("all");
                setStatusFilter("all");
                setTierFilter("all");
                setView("table");
              }}
              title="כל ההגשות — פתיחה בטבלה"
              className="w-full cursor-pointer"
            >
              <div className="font-display text-xl font-black leading-none">{counts.total}</div>
              <div className="mt-1 text-[11.5px] font-semibold">הגישו</div>
            </button>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              <button
                type="button"
                aria-pressed={tierFilter === "subscribers"}
                onClick={() => {
                  setTierFilter((v) => (v === "subscribers" ? "all" : "subscribers"));
                  setView("table");
                }}
                title="רק המנויות מבין המגישות — פתיחה בטבלה"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10.5px] font-bold border cursor-pointer transition-colors",
                  tierFilter === "subscribers"
                    ? "bg-brand-pink-deep text-white border-brand-pink-deep"
                    : "bg-tint-pink text-brand-pink-deep border-[#F3C6DD] hover:border-brand-pink-deep"
                )}
              >
                מנויות {counts.subscribers}
              </button>
              <button
                type="button"
                aria-pressed={tierFilter === "vip"}
                onClick={() => {
                  setTierFilter((v) => (v === "vip" ? "all" : "vip"));
                  setView("table");
                }}
                title="רק ה-VIP מבין המגישות — פתיחה בטבלה"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10.5px] font-bold border cursor-pointer transition-colors",
                  tierFilter === "vip"
                    ? "bg-[#8C5E0E] text-white border-[#8C5E0E]"
                    : "bg-tint-warm text-[#8C5E0E] border-[#E5C55C] hover:border-[#8C5E0E]"
                )}
              >
                ⭐ VIP {counts.vips}
              </button>
            </div>
          </div>
          <Stat
            label="לא מתאימות"
            value={counts.notFit}
            active={markFilter === "not_fit"}
            onClick={() => {
              setStatusFilter("all");
              setMarkFilter((v) => (v === "not_fit" ? "all" : "not_fit"));
              setView("table");
            }}
            className="border-[#F2BBC8] bg-danger-bg text-[#A8254B]"
          />
          <Stat
            label="אופציונליות"
            value={counts.optional}
            active={markFilter === "optional"}
            onClick={() => {
              setStatusFilter("all");
              setMarkFilter((v) => (v === "optional" ? "all" : "optional"));
              setView("table");
            }}
            className="border-[#F0DCA8] bg-tint-warm text-[#8C5E0E]"
          />
          <Stat
            label="אושרו סופית"
            value={counts.approved}
            active={markFilter === "approved"}
            onClick={() => {
              setStatusFilter("all");
              setMarkFilter((v) => (v === "approved" ? "all" : "approved"));
              setView("table");
            }}
            className="border-[#BFE4D1] bg-tint-mint text-[#0F6E4A]"
          />
          <Stat
            label="הוגשו סופית"
            value={counts.sentToClient}
            active={statusFilter === "sent"}
            onClick={() => {
              setMarkFilter("all");
              setStatusFilter((v) => (v === "sent" ? "all" : "sent"));
              setView("table");
            }}
            className="border-[#DDC9EC] bg-tint-purple text-brand-purple"
          />
        </div>
      </div>

      {/* Per-job note for whoever reviews — travels with the job, not a member. */}
      <TeamNoteBox jobId={jobId} initial={teamNote} />

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
        <button
          type="button"
          onClick={() => exportCsv(filtered, questions, statusOf, markOf, jobTitle)}
          className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-0 px-2.5 py-1 text-[12px] font-semibold text-ink-600 hover:text-brand-purple hover:border-brand-purple cursor-pointer"
          title="ייצוא הרשימה המסוננת לאקסל"
        >
          ייצוא לאקסל ({filtered.length})
        </button>
        {/* view toggle — רשימה / טבלה */}
        <div
          className="ms-auto flex items-center gap-1"
          role="group"
          aria-label="בחירת תצוגה"
        >
          {(
            [
              { key: "list", label: "רשימה", Icon: List },
              { key: "table", label: "טבלה", Icon: Table2 },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors cursor-pointer",
                view === key
                  ? "border-brand-purple bg-tint-purple text-brand-purple"
                  : "border-ink-200 bg-ink-0 text-ink-500 hover:text-ink-900 hover:border-ink-400"
              )}
            >
              <Icon size={13} aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------- profile-criteria bar */}
      {criteriaCatalogue.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-ink-200 bg-ink-0 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-ink-700">סינון לפי פרופיל:</span>
            <Select
              value={activeKey}
              onChange={(e) => {
                setActiveKey(e.target.value);
                setValueQuery("");
              }}
              className="w-auto min-w-[160px] py-2"
              aria-label="בחירת פרמטר לסינון"
            >
              {criteriaCatalogue.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                  {criteria[f.key]?.length ? ` (${criteria[f.key].length})` : ""}
                </option>
              ))}
            </Select>
            {activeField && activeField.values.length > 8 && (
              <Input
                type="search"
                value={valueQuery}
                onChange={(e) => setValueQuery(e.target.value)}
                placeholder="סינון הערכים ברשימה…"
                aria-label="סינון הערכים ברשימה"
                className="w-auto min-w-[160px] py-2"
              />
            )}
          </div>
          <div
            role="group"
            aria-label={activeField ? `ערכים עבור ${activeField.label}` : "ערכים"}
            className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto"
          >
            {visibleValues.length === 0 ? (
              <p className="text-[12px] text-ink-500 p-1">אין ערכים תואמים.</p>
            ) : (
              visibleValues.map((value) => {
                const on = (criteria[activeKey] ?? []).includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleCriterion(activeKey, value)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center px-3 py-[5px] rounded-full text-xs font-semibold transition-colors duration-150 border cursor-pointer",
                      on
                        ? "bg-brand-pink-deep text-white border-brand-pink-deep"
                        : "bg-ink-0 text-ink-700 border-ink-200 hover:border-brand-purple"
                    )}
                  >
                    {value}
                  </button>
                );
              })
            )}
          </div>
          {criteriaChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-ink-100">
              <span className="text-[12px] text-ink-500">הסינון הפעיל:</span>
              {criteriaChips.map((chip) => (
                <button
                  key={`${chip.key}:${chip.value}`}
                  type="button"
                  onClick={() => toggleCriterion(chip.key, chip.value)}
                  className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-xs font-semibold bg-tint-pink text-brand-pink-deep hover:bg-brand-pink-deep hover:text-white transition-colors duration-150 cursor-pointer"
                >
                  <span className="opacity-70">{chip.label}:</span>
                  {chip.value}
                  <X size={12} aria-hidden />
                  <span className="sr-only">הסרת הסינון</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCriteria({})}
                className="text-[12px] text-ink-500 underline underline-offset-2 hover:text-brand-pink-deep cursor-pointer"
              >
                איפוס
              </button>
            </div>
          )}
        </div>
      )}

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {/* ------------------------------------------------- bulk action bar */}
      {visibleSelection.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-[14px] border border-brand-purple/40 bg-tint-purple p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-bold text-brand-purple whitespace-nowrap">
              {visibleSelection.size} נבחרו
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setBulkReasonOpen(true)}
            >
              סימון כלא רלוונטיות
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => applyBulk("optional")}>
              אופציונליות
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => applyBulk("approved")}>
              אישור סופי
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => applyBulk(null)}>
              ניקוי סימון
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              ביטול בחירה
            </Button>
          </div>
          {bulkReasonOpen && (
            <div className="flex flex-col gap-2 rounded-[12px] border border-ink-200 bg-ink-0 p-3">
              <Textarea
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="סיבה משותפת (אופציונלי, רק לך)"
                aria-label="סיבה משותפת לאי-ההתאמה (פנימי, אופציונלי)"
                maxLength={500}
                rows={2}
                autoFocus
                className="min-h-16 text-[13px]"
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => applyBulk("not_fit", bulkReason)}>
                  סימון {visibleSelection.size} כלא רלוונטיות
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setBulkReasonOpen(false);
                    setBulkReason("");
                  }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------- table view */}
      {view === "table" && (
        <div className="max-h-[560px] overflow-x-auto overflow-y-auto rounded-[14px] border border-ink-200 bg-ink-0">
          {filtered.length === 0 ? (
            <p className="text-ink-500 text-sm px-3 py-4">אין מועמדות שתואמות את הסינון.</p>
          ) : (
            <table className="w-full min-w-[1020px] text-sm border-separate border-spacing-0">
              <thead>
                {/* Label + that column's own filter, stacked in one sticky
                    header (the owner: "מעל הטבלה אופציה לסנן לפי כל עמודה"). */}
                <tr className="text-start">
                  {(
                    [
                      {
                        key: "check",
                        head: (
                          <Checkbox
                            checked={tableRows.length > 0 && tableRows.every((a) => selection.has(a.id))}
                            onChange={(e) =>
                              setSelection(e.target.checked ? new Set(tableRows.map((a) => a.id)) : new Set())
                            }
                            aria-label="בחירת כל המועמדות המוצגות"
                          />
                        ),
                        filter: null,
                      },
                      {
                        key: "name",
                        head: "שם",
                        filter: (
                          <input
                            value={colFilters.name}
                            onChange={(e) => setCol("name")(e.target.value)}
                            placeholder="סינון…"
                            aria-label="סינון לפי שם"
                            className="mt-1 w-full min-w-[110px] rounded-md border border-ink-200 bg-ink-0 px-1.5 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          />
                        ),
                      },
                      {
                        key: "spec",
                        head: "תחום",
                        filter: (
                          <select
                            value={colFilters.spec}
                            onChange={(e) => setCol("spec")(e.target.value)}
                            aria-label="סינון לפי תחום"
                            className="mt-1 w-full rounded-md border border-ink-200 bg-ink-0 px-1 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          >
                            <option value="">הכול</option>
                            {colOptions.specs.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ),
                      },
                      {
                        key: "region",
                        head: "אזור",
                        filter: (
                          <select
                            value={colFilters.region}
                            onChange={(e) => setCol("region")(e.target.value)}
                            aria-label="סינון לפי אזור"
                            className="mt-1 w-full rounded-md border border-ink-200 bg-ink-0 px-1 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          >
                            <option value="">הכול</option>
                            {colOptions.regions.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ),
                      },
                      {
                        key: "exp",
                        head: "ניסיון",
                        filter: (
                          <select
                            value={colFilters.exp}
                            onChange={(e) => setCol("exp")(e.target.value)}
                            aria-label="סינון לפי ניסיון"
                            className="mt-1 w-full rounded-md border border-ink-200 bg-ink-0 px-1 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          >
                            <option value="">הכול</option>
                            <option value="yes">בעלת ניסיון</option>
                            <option value="no">בלי ניסיון</option>
                          </select>
                        ),
                      },
                      {
                        key: "status",
                        head: "סטטוס",
                        filter: (
                          <select
                            value={colFilters.status}
                            onChange={(e) => setCol("status")(e.target.value)}
                            aria-label="סינון לפי סטטוס"
                            className="mt-1 w-full rounded-md border border-ink-200 bg-ink-0 px-1 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          >
                            <option value="">הכול</option>
                            {colOptions.statuses.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s] ?? s}
                              </option>
                            ))}
                          </select>
                        ),
                      },
                      {
                        key: "mark",
                        head: "סימון פנימי",
                        filter: (
                          <select
                            value={colFilters.mark}
                            onChange={(e) => setCol("mark")(e.target.value)}
                            aria-label="סינון לפי סימון פנימי"
                            className="mt-1 w-full rounded-md border border-ink-200 bg-ink-0 px-1 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          >
                            <option value="">הכול</option>
                            {colOptions.marks.map((m) => (
                              <option key={m} value={m}>
                                {m === "none" ? "ללא סימון" : MARK_LABEL[m as AdminMark]}
                              </option>
                            ))}
                          </select>
                        ),
                      },
                      { key: "date", head: "הוגשה", filter: null },
                      {
                        key: "note",
                        head: "הערה",
                        filter: (
                          <input
                            value={colFilters.note}
                            onChange={(e) => setCol("note")(e.target.value)}
                            placeholder="סינון…"
                            aria-label="סינון לפי הערה"
                            className="mt-1 w-full min-w-[110px] rounded-md border border-ink-200 bg-ink-0 px-1.5 py-0.5 text-[11.5px] font-normal outline-none focus:border-brand-purple"
                          />
                        ),
                      },
                      { key: "open", head: "", filter: null },
                    ] as const
                  ).map((c) => (
                    <th
                      key={c.key}
                      className="sticky top-0 z-[1] bg-ink-50 border-b border-ink-200 px-3 py-2 text-start text-[11.5px] font-bold text-ink-700 whitespace-nowrap align-top"
                    >
                      {c.head}
                      {c.filter}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anyColFilter && tableRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-sm text-ink-500">
                      אין מועמדות שתואמות את סינון העמודות.{" "}
                      <button
                        type="button"
                        onClick={() =>
                          setColFilters({ name: "", spec: "", region: "", exp: "", status: "", mark: "", note: "" })
                        }
                        className="font-semibold text-brand-purple underline cursor-pointer"
                      >
                        ניקוי סינון עמודות
                      </button>
                    </td>
                  </tr>
                )}
                {tableRows.map((a, i) => {
                  const mark = markOf(a);
                  const status = statusOf(a);
                  const reason = reasonOf(a);
                  return (
                    <tr key={a.id} className={cn(i % 2 === 1 ? "bg-ink-50" : "bg-ink-0")}>
                      <td className="border-b border-ink-100 px-3 py-2 align-top">
                        <Checkbox
                          checked={selection.has(a.id)}
                          onChange={(e) => toggleSelected(a.id, e.target.checked)}
                          aria-label={`בחירת ${a.profile?.fullName ?? "מועמדת"}`}
                        />
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-ink-900 whitespace-nowrap">
                            {a.profile?.fullName ?? "מועמדת"}
                          </span>
                          <MemberFlair app={a} starClass="text-[12px]" />
                        </span>
                        {mark === "not_fit" && reason && (
                          <span className="block max-w-[220px] truncate text-[11px] text-ink-400">
                            הסיבה שלך: {reason}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top text-[13px] text-ink-700 whitespace-nowrap">
                        {a.profile?.specialization ?? "—"}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top text-[13px] text-ink-700 whitespace-nowrap">
                        {a.profile?.region ?? "—"}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top text-[13px] text-ink-700 whitespace-nowrap">
                        {a.profile?.isExperienced ? "בעלת ניסיון" : "—"}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top whitespace-nowrap">
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-700">
                          {STATUS_LABEL[status] ?? status}
                        </span>
                        {/* One-click "we submitted her" — with or without a
                            portal client (the PM couldn't find where). */}
                        {(status === "submitted" || status === "in_review") && (
                          <button
                            type="button"
                            onClick={() => applyPipeline(a, "sent")}
                            className="ms-1.5 rounded-full border border-brand-purple/40 px-2 py-0.5 text-[10.5px] font-bold text-brand-purple hover:bg-tint-purple cursor-pointer"
                            title="סימון שהגשנו אותה למעסיק — עובר להוגשה ללקוח"
                          >
                            הוגשה ✓
                          </button>
                        )}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top whitespace-nowrap">
                        {mark ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                              MARK_CHIP[mark]
                            )}
                          >
                            {MARK_LABEL[mark]}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top text-[13px] text-ink-700 tabular-nums whitespace-nowrap">
                        {fmtDate(a.submittedAt)}
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top min-w-[170px]">
                        <NoteCell
                          key={`${a.id}:${noteValOf(a) ?? ""}`}
                          appId={a.id}
                          value={noteValOf(a)}
                          onSaved={(v) => setNotes((prev) => ({ ...prev, [a.id]: v }))}
                          onError={setActionError}
                        />
                      </td>
                      <td className="border-b border-ink-100 px-3 py-2 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(a.id);
                            setView("list");
                          }}
                          className="text-[12.5px] font-semibold text-brand-purple hover:underline cursor-pointer"
                        >
                          פתיחה
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------- list + detail */}
      {view === "list" && (
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
        {/* list */}
        <div className="flex flex-col max-h-[560px] overflow-y-auto rounded-[14px] border border-ink-200 bg-ink-0">
          {filtered.length === 0 && (
            <p className="text-ink-500 text-sm px-3 py-4">אין מועמדות שתואמות את הסינון.</p>
          )}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-3 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                label={
                  <span className="text-[11.5px] font-semibold text-ink-700">
                    בחירת כל המוצגות ({filtered.length})
                  </span>
                }
              />
            </div>
          )}
          {filtered.map((a) => {
            const active = selected?.id === a.id;
            const mark = markOf(a);
            const status = statusOf(a);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-1.5 border-b border-ink-100 ps-3 transition-colors last:border-b-0",
                  active ? "bg-tint-purple" : "hover:bg-ink-50"
                )}
              >
                <span className="pt-3">
                  <Checkbox
                    checked={selection.has(a.id)}
                    onChange={(e) => toggleSelected(a.id, e.target.checked)}
                    aria-label={`בחירת ${a.profile?.fullName ?? "מועמדת"}`}
                  />
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex min-w-0 flex-1 flex-col items-stretch gap-1 pe-3 py-2.5 text-start cursor-pointer"
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
              </div>
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

            {/* The team's general note about her (from her member page). */}
            {selected.crmNote && (
              <p className="text-[13px] text-ink-700 bg-tint-warm border border-[#F0DCA8] rounded-md px-3 py-2 whitespace-pre-wrap">
                <b className="text-[#8C5E0E]">הערה פנימית עליה (ממסך החברות):</b> {selected.crmNote}
              </p>
            )}

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
      )}
    </div>
  );
}

// ------------------------------------------------------------- team note box

/**
 * The per-job internal note ("בדקנו מול הלקוח ש…") — for whoever reviews the
 * applicants of THIS job. Saved on blur/button, never shown outside admin.
 */
function TeamNoteBox({ jobId, initial }: { jobId: string; initial: string | null }) {
  const [note, setNote] = useState(initial ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = note !== (initial ?? "") && savedAt === null;

  return (
    <div className="rounded-[14px] border border-[#F0DCA8] bg-tint-warm/50 p-3.5 flex flex-col gap-2">
      <div className="text-[12.5px] font-bold text-[#8C5E0E]">
        הערה שלנו למשרה הזו (פנימית — לצוות שעובר על ההגשות)
      </div>
      <Textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSavedAt(null);
        }}
        rows={2}
        placeholder="למשל: הלקוח מחפש דווקא ניסיון בצד לקוח, לשים לב לפרויקטים אמיתיים…"
        className="bg-white"
      />
      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          size="sm"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const { setJobTeamNote } = await import("@/app/(admin)/admin/actions");
              await setJobTeamNote(jobId, note);
              setSavedAt("now");
            })
          }
        >
          {pending ? "שומר…" : "שמירת ההערה"}
        </Button>
        {savedAt && <span className="text-[12px] font-semibold text-success">נשמר ✓</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- csv export

/** The filtered applicant list, as an Excel-friendly CSV (BOM + CRLF). */
function exportCsv(
  list: ReviewApplication[],
  questions: ReviewQuestion[],
  statusOf: (a: ReviewApplication) => string,
  markOf: (a: ReviewApplication) => AdminMark | null,
  jobTitle: string
) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "שם",
    "התמחות",
    "אזור",
    "מנויה",
    "VIP",
    "סטטוס",
    "סימון פנימי",
    "הוגשה בתאריך",
    "למה מתאימה",
    ...questions.map((q) => q.question),
  ];
  const rows = list.map((a) => [
    a.profile?.fullName ?? "",
    a.profile?.specialization ?? "",
    a.profile?.region ?? "",
    a.isSubscriber ? "כן" : "לא",
    a.isVip ? "כן" : "לא",
    STATUS_LABEL[statusOf(a)] ?? statusOf(a),
    markOf(a) ? MARK_LABEL[markOf(a)!] : "",
    fmtDate(a.submittedAt),
    answerText(a.answers["fit"] ?? ""),
    ...questions.map((q) => answerText(a.answers[q.id] ?? "")),
  ]);
  const csv =
    "\uFEFF" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `applicants-${jobTitle.replace(/[^\w\u0590-\u05FF-]+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
