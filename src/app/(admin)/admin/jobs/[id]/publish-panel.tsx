"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Megaphone, Plus, Search, Users, X } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, Select } from "@/components/ui";
import {
  previewAudience,
  publishJob,
  reopenJobPublish,
  type AudienceMember,
} from "@/app/(admin)/admin/actions";
import type { AudienceCatalogueField, AudienceEligibility } from "@/lib/admin/audience";
import type { PickerMember } from "./candidate-picker";

const MAX_SEARCH_ROWS = 8;
const PREVIEW_DEBOUNCE_MS = 300;

/**
 * The targeted-publish flow for an "ours" job: pick criteria over ANY profile
 * parameter (the catalogue mirrors the portal search: parameter select + value
 * chips + active-filter chips) plus experience, preview the matching audience
 * with per-member checkboxes, optionally add anyone by search, then publish —
 * which writes job_targets, opens the job and emails every target.
 *
 * After publish (published != null) it renders the summary + re-open option.
 */
export function PublishPanel({
  jobId,
  catalogue,
  eligibility,
  allMembers,
  published,
}: {
  jobId: string;
  /** Every filterable profile criterion, from buildAudienceCatalogue(). */
  catalogue: AudienceCatalogueField[];
  /** Who the pool holds and who it leaves out — stated in the panel, not implied. */
  eligibility: AudienceEligibility | null;
  /** All active members, for the "add anyone" search (same list as the candidate picker). */
  allMembers: PickerMember[];
  /** Null while the job is a draft; otherwise the published summary. */
  published: { at: string | null; audienceCount: number } | null;
}) {
  const router = useRouter();
  // question key → selected values. Filters accumulate across parameters, so
  // switching the visible parameter never changes what's selected.
  const [criteria, setCriteria] = useState<Record<string, string[]>>({});
  const [activeKey, setActiveKey] = useState(catalogue[0]?.key ?? "");
  const [valueQuery, setValueQuery] = useState("");
  const [exp, setExp] = useState<"all" | "yes" | "no">("all");
  const [incMentors, setIncMentors] = useState(false);
  const [incIncomplete, setIncIncomplete] = useState(false);
  const [audience, setAudience] = useState<AudienceMember[] | null>(null);
  // The community-wide eligible pool (before criteria) — for honest empty states.
  const [pool, setPool] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<PickerMember[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [publishing, startPublish] = useTransition();

  const isDraft = published === null;

  // Live audience preview — refetch whenever the criteria change (debounced,
  // so rapid chip-toggling fires one request instead of one per click).
  useEffect(() => {
    if (!isDraft) return;
    const timer = setTimeout(() => {
      startPreview(async () => {
        const res = await previewAudience(jobId, {
          criteria,
          experienced: exp === "all" ? undefined : exp === "yes",
          includeMentors: incMentors,
          includeIncomplete: incIncomplete,
        });
        if (!res.members) {
          setError(res.error ?? "טעינת הקהל נכשלה. נסי שוב.");
          return;
        }
        setError(null);
        setPool(res.pool ?? null);
        setAudience(res.members);
        // New criteria — start with everyone matched checked.
        setChecked(new Set(res.members.map((m) => m.id)));
        // Anyone manually added who now matches the criteria is no longer "extra".
        const ids = new Set(res.members.map((m) => m.id));
        setExtras((prev) => prev.filter((e) => !ids.has(e.id)));
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isDraft, jobId, criteria, exp, incMentors, incIncomplete, startPreview]);

  const audienceIds = useMemo(() => new Set((audience ?? []).map((m) => m.id)), [audience]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const extraIds = new Set(extras.map((e) => e.id));
    return allMembers
      .filter((m) => !audienceIds.has(m.id) && !extraIds.has(m.id))
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.specialization ?? "").toLowerCase().includes(q)
      )
      .slice(0, MAX_SEARCH_ROWS);
  }, [allMembers, audienceIds, extras, query]);

  // The search used to fail in absolute silence: with no criteria the audience
  // IS the whole eligible pool, so every name "already there" returned nothing,
  // and a mentor/staff/incomplete-profile name returned nothing either — the
  // admin typed and nothing happened at all. Name the reason instead.
  const searchEmptyReason = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || searchResults.length > 0) return null;
    const nameMatch = (m: { full_name: string }) => m.full_name.toLowerCase().includes(q);
    if ((audience ?? []).some((m) => nameMatch(m) && audienceIds.has(m.id))) {
      return "היא כבר בקהל היעד — סמני אותה ברשימה שלמעלה.";
    }
    if (extras.some(nameMatch)) {
      return "היא כבר נוספה ידנית — מופיעה בתגיות שלמעלה.";
    }
    return "לא נמצאה ברשימת הזמינות להשמה. מנטוריות, צוות, מושהות ומי שלא השלימה פרופיל אינן זמינות לפרסום משרות.";
  }, [query, searchResults, audience, audienceIds, extras]);

  const selectedCount = checked.size + extras.length;
  /** Anything actually narrowing the pool — criteria chips or the experience select. */
  const narrowed = Object.keys(criteria).length > 0 || exp !== "all";

  const active = catalogue.find((f) => f.key === activeKey) ?? null;

  const visibleValues = useMemo(() => {
    if (!active) return [];
    const q = valueQuery.trim().toLowerCase();
    return q ? active.values.filter((v) => v.toLowerCase().includes(q)) : active.values;
  }, [active, valueQuery]);

  // The active-filter chips row — every selected value across all parameters.
  const chips = useMemo(
    () =>
      Object.entries(criteria).flatMap(([key, values]) =>
        values.map((value) => ({
          key,
          value,
          label: catalogue.find((f) => f.key === key)?.label ?? key,
        }))
      ),
    [catalogue, criteria]
  );

  function toggleValue(key: string, value: string) {
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

  function toggleMember(id: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onPublish() {
    const manualIds = extras.map((e) => e.id);
    const ids = [...checked, ...manualIds];
    startPublish(async () => {
      // Hand-picked members are recorded as source 'manual', so the admin can
      // later tell who matched the criteria and who she added by name.
      const res = await publishJob(jobId, ids, manualIds);
      if (!res.ok) {
        setError(res.error ?? "הפרסום נכשל. נסי שוב.");
        return;
      }
      setError(null);
      setResult({ sent: res.sent ?? 0, failed: res.failed ?? 0 });
      router.refresh();
    });
  }

  function onReopen() {
    startPublish(async () => {
      setResult(null);
      await reopenJobPublish(jobId);
      router.refresh();
    });
  }

  // ------------------------------------------------------ published summary
  if (!isDraft) {
    return (
      <div className="flex flex-col gap-3">
        {result && (
          <Alert variant={result.failed > 0 ? "warn" : "success"} title="המשרה פורסמה 🎉">
            נשלחו {result.sent} מיילים לחברות שבקהל היעד
            {result.failed > 0 ? `, ${result.failed} שליחות נכשלו` : ""}.
          </Alert>
        )}
        <div className="flex items-center gap-4 flex-wrap text-sm text-ink-700">
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck size={15} className="text-brand-purple" />
            פורסמה ב־
            {published.at
              ? new Date(published.at).toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} className="text-brand-purple" />
            קהל היעד: {published.audienceCount} חברות
          </span>
          <Badge variant="mint">מפורסמת ✓</Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="secondary" onClick={onReopen} disabled={publishing}>
            {publishing ? "פותח…" : "פתיחה מחדש של הפרסום"}
          </Button>
          <span className="text-[12px] text-ink-500">
            פתיחה מחדש מאפשרת להרחיב את הקהל — מייל יישלח רק לחברות חדשות שיתווספו.
          </span>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- draft panel
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Criteria — every profile parameter, mirroring the portal search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 flex flex-col gap-2">
          <div className="text-xs font-semibold text-ink-700">פרמטר</div>
          {catalogue.length === 0 ? (
            <span className="text-[12px] text-ink-400">אין פרמטרים מוגדרים לסינון.</span>
          ) : (
            <>
              <Select
                value={activeKey}
                onChange={(e) => {
                  setActiveKey(e.target.value);
                  setValueQuery("");
                }}
                aria-label="בחירת פרמטר לסינון"
              >
                {catalogue.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                    {criteria[f.key]?.length ? ` (${criteria[f.key].length})` : ""}
                  </option>
                ))}
              </Select>
              {active && active.values.length > 8 && (
                <Input
                  type="search"
                  value={valueQuery}
                  onChange={(e) => setValueQuery(e.target.value)}
                  placeholder="סינון הערכים ברשימה…"
                  aria-label="סינון הערכים ברשימה"
                />
              )}
              <div
                role="group"
                aria-label={active ? `ערכים עבור ${active.label}` : "ערכים"}
                className="max-h-48 overflow-y-auto rounded-md border border-ink-200 bg-ink-50 p-2 flex flex-wrap gap-1.5"
              >
                {visibleValues.length === 0 ? (
                  <p className="text-[12px] text-ink-500 p-1.5">אין ערכים תואמים.</p>
                ) : (
                  visibleValues.map((value) => {
                    const on = (criteria[activeKey] ?? []).includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleValue(activeKey, value)}
                        aria-pressed={on}
                        className={[
                          "inline-flex items-center px-3 py-[5px] rounded-full text-xs font-semibold",
                          "transition-colors duration-150 border cursor-pointer",
                          on
                            ? "bg-brand-pink-deep text-white border-brand-pink-deep"
                            : "bg-ink-0 text-ink-700 border-ink-200 hover:border-brand-purple",
                        ].join(" ")}
                      >
                        {value}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold text-ink-700 mb-2">סינון לפי ניסיון</div>
          <Select value={exp} onChange={(e) => setExp(e.target.value as "all" | "yes" | "no")}>
            <option value="all">הכל</option>
            <option value="yes">רק בעלות ניסיון</option>
            <option value="no">רק ג׳וניוריות</option>
          </Select>
          {/* Senior roles reach mentors too — but only when the admin says so. */}
          <label className="flex items-center gap-2 mt-3 text-[13px] text-ink-900 cursor-pointer">
            <input
              type="checkbox"
              checked={incMentors}
              onChange={(e) => setIncMentors(e.target.checked)}
              className="accent-brand-purple"
            />
            לכלול גם מנטוריות (משרות לבעלות ניסיון)
          </label>
          {/* Everyone who signed up, mid-questionnaire included (the owner,
              1/9) — they join wholesale, since there's nothing to match yet. */}
          <label className="flex items-center gap-2 mt-2 text-[13px] text-ink-900 cursor-pointer">
            <input
              type="checkbox"
              checked={incIncomplete}
              onChange={(e) => setIncIncomplete(e.target.checked)}
              className="accent-brand-purple"
            />
            לכלול גם מי שעוד לא סיימה את השאלון (מצטרפות בלי התאמת קריטריונים)
          </label>
          <p className="text-[12px] text-ink-400 mt-2">
            בלי סימון קריטריונים נכללות כל הזמינות להשמה — הרשימה המלאה מופיעה למטה.
          </p>
        </div>
      </div>

      {/* Who the pool actually holds. Stated always, not only when it's empty —
          "בלי קריטריונים" is NOT "כל הקהילה", and the admin compares this
          against /admin/members, which lists everyone with no gates at all. */}
      {eligibility && (
        <p className="text-[12px] text-ink-500 leading-relaxed bg-ink-50 border border-ink-200 rounded-md px-3 py-2">
          קהל היעד נבנה מהחברות שזמינות להשמה: ג׳וניוריות פעילות או חינמיות שהשלימו את
          הפרופיל — <b className="text-ink-900">{eligibility.eligible}</b> כרגע. לא נכללות:{" "}
          {eligibility.notCompleted} שעדיין לא סיימו למלא את הפרופיל
          {eligibility.paused > 0 ? `, ${eligibility.paused} בהשהיה` : ""}, וגם מנטוריות
          וצוות ({eligibility.staff}). חברה שהקריטריונים סיננו החוצה אפשר להחזיר בשם דרך
          החיפוש שלמטה.
        </p>
      )}

      {/* Active filters */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-500">הסינון הפעיל:</span>
          {chips.map((chip) => (
            <button
              key={`${chip.key}:${chip.value}`}
              type="button"
              onClick={() => toggleValue(chip.key, chip.value)}
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

      {/* Audience preview */}
      <div className="border border-ink-200 rounded-md p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Users size={15} className="text-brand-purple" />
          <span className="font-display text-sm font-bold text-ink-1000">
            קהל היעד: {selectedCount} חברות נבחרו
          </span>
          {pool !== null && audience !== null && (
            <span className="text-[12px] text-ink-500">
              {narrowed
                ? `הקריטריונים התאימו ל־${audience.length} מתוך ${pool} הזמינות להשמה`
                : `כל ${pool} הזמינות להשמה`}
            </span>
          )}
          {previewing && <Loader2 size={14} className="animate-spin text-ink-400" />}
        </div>
        {audience === null ? (
          <p className="text-ink-500 text-sm py-1">טוען את הקהל המתאים…</p>
        ) : audience.length === 0 ? (
          <p className="text-ink-500 text-sm py-1">
            {pool === 0
              ? "אין כרגע בקהילה ג׳וניוריות פעילות שהשלימו את הפרופיל — הקהל ייבנה כאן ברגע שיהיו. (גם חברות חינמיות נכללות.)"
              : exp !== "all" && Object.keys(criteria).length === 0
                ? exp === "yes"
                  ? `אין כרגע בעלות ניסיון בקהל הזמין להשמה — כל ${pool} הזמינות הן בתחילת הדרך. סינון "הכל" יציג אותן.`
                  : `אין כרגע ג׳וניוריות בתחילת הדרך בקהל הזמין להשמה — כל ${pool} הזמינות הן בעלות ניסיון. סינון "הכל" יציג אותן.`
                : "אין חברות שמתאימות לקריטריונים — אפשר להרחיב אותם או להוסיף ידנית למטה."}
          </p>
        ) : (
          <div className="flex flex-col max-h-[320px] overflow-y-auto">
            {audience.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0"
              >
                <Checkbox
                  checked={checked.has(m.id)}
                  onChange={(e) => toggleMember(m.id, e.target.checked)}
                  label={
                    <span className="flex flex-col">
                      <span className="font-medium text-ink-900 inline-flex items-center gap-1.5">
                        {m.full_name}
                        {m.is_vip && (
                          <span title="VIP — עדיפות בהשמות" className="text-[13px]">⭐</span>
                        )}
                        {m.is_subscriber && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tint-pink text-brand-pink-deep">
                            מנויה
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-ink-500">
                        {[m.specialization, m.region].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add anyone */}
      <div>
        <div className="text-xs font-semibold text-ink-700 mb-0.5">
          הוספת חברה נוספת (מעבר לקריטריונים)
        </div>
        {/* Honest scope note: this search reads the SAME eligible pool, so it
            can add back someone the criteria filtered out — but not a member
            who hasn't finished her profile. */}
        <p className="text-[12px] text-ink-400 mb-2">
          החיפוש מציע את מי שזמינה להשמה וסוננה החוצה על ידי הקריטריונים. מי שעדיין לא
          השלימה פרופיל לא תופיע כאן.
        </p>
        {extras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {extras.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1 bg-tint-purple text-brand-purple text-[12.5px] font-semibold rounded-full px-3 py-1"
              >
                {e.full_name}
                <button
                  type="button"
                  aria-label={`הסרת ${e.full_name}`}
                  onClick={() => setExtras((prev) => prev.filter((x) => x.id !== e.id))}
                  className="hover:text-danger cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400 pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם או התמחות…"
            className="ps-9"
          />
        </div>
        {searchEmptyReason && (
          <p className="text-[12.5px] text-ink-500 bg-ink-50 border border-ink-200 rounded-md px-3 py-2 mt-2">
            {searchEmptyReason}
          </p>
        )}
        {searchResults.length > 0 && (
          <div className="flex flex-col border border-ink-200 rounded-md mt-2 divide-y divide-ink-100">
            {searchResults.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate text-sm">{m.full_name}</div>
                  <div className="text-xs text-ink-500 truncate">{m.specialization ?? "—"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExtras((prev) => [...prev, m]);
                    setQuery("");
                  }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold rounded-md px-2.5 py-1 bg-brand-gradient text-white hover:brightness-105 cursor-pointer"
                >
                  <Plus size={12} /> הוספה
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Publish */}
      <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-ink-100">
        <Button onClick={onPublish} disabled={publishing || selectedCount === 0}>
          <Megaphone size={15} />
          {publishing ? "מפרסם ושולח מיילים…" : `פרסום המשרה ל־${selectedCount} חברות`}
        </Button>
        <span className="text-[12px] text-ink-500">
          הפרסום פותח את המשרה לקהל שנבחר ושולח לכל אחת מייל אישי.
        </span>
      </div>
    </div>
  );
}
