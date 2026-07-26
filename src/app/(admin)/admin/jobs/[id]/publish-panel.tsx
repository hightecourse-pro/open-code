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
import type { PickerMember } from "./candidate-picker";

export interface TaxOption {
  value: string;
  label: string;
}

const MAX_SEARCH_ROWS = 8;

/**
 * The targeted-publish flow for an "ours" job: pick criteria (specialization /
 * region / experience), preview the matching audience with per-member
 * checkboxes, optionally add anyone by search, then publish — which writes
 * job_targets, opens the job and emails every target.
 *
 * After publish (published != null) it renders the summary + re-open option.
 */
export function PublishPanel({
  jobId,
  specializations,
  regions,
  allMembers,
  published,
}: {
  jobId: string;
  specializations: TaxOption[];
  regions: TaxOption[];
  /** All active members, for the "add anyone" search (same list as the candidate picker). */
  allMembers: PickerMember[];
  /** Null while the job is a draft; otherwise the published summary. */
  published: { at: string | null; audienceCount: number } | null;
}) {
  const router = useRouter();
  const [selSpec, setSelSpec] = useState<string[]>([]);
  const [selRegion, setSelRegion] = useState<string[]>([]);
  const [exp, setExp] = useState<"all" | "yes" | "no">("all");
  const [audience, setAudience] = useState<AudienceMember[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<PickerMember[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [publishing, startPublish] = useTransition();

  const isDraft = published === null;

  // Live audience preview — refetch whenever the criteria change.
  useEffect(() => {
    if (!isDraft) return;
    startPreview(async () => {
      const res = await previewAudience(jobId, {
        specialization: selSpec,
        region: selRegion,
        experienced: exp === "all" ? undefined : exp === "yes",
      });
      if (!res.members) {
        setError(res.error ?? "טעינת הקהל נכשלה. נסי שוב.");
        return;
      }
      setError(null);
      setAudience(res.members);
      // New criteria — start with everyone matched checked.
      setChecked(new Set(res.members.map((m) => m.id)));
      // Anyone manually added who now matches the criteria is no longer "extra".
      const ids = new Set(res.members.map((m) => m.id));
      setExtras((prev) => prev.filter((e) => !ids.has(e.id)));
    });
  }, [isDraft, jobId, selSpec, selRegion, exp, startPreview]);

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

  const selectedCount = checked.size + extras.length;

  function toggleCriterion(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
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
    const ids = [...checked, ...extras.map((e) => e.id)];
    startPublish(async () => {
      const res = await publishJob(jobId, ids);
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
            {publishing ? "פותחת…" : "פתיחה מחדש של הפרסום"}
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

      {/* Criteria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs font-semibold text-ink-700 mb-2">תחום התמחות</div>
          <div className="flex flex-col gap-1.5">
            {specializations.map((o) => (
              <Checkbox
                key={o.value}
                label={o.label}
                checked={selSpec.includes(o.value)}
                onChange={() => toggleCriterion(selSpec, o.value, setSelSpec)}
              />
            ))}
            {specializations.length === 0 && (
              <span className="text-[12px] text-ink-400">אין תחומים מוגדרים.</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-ink-700 mb-2">אזור</div>
          <div className="flex flex-col gap-1.5">
            {regions.map((o) => (
              <Checkbox
                key={o.value}
                label={o.label}
                checked={selRegion.includes(o.value)}
                onChange={() => toggleCriterion(selRegion, o.value, setSelRegion)}
              />
            ))}
            {regions.length === 0 && (
              <span className="text-[12px] text-ink-400">אין אזורים מוגדרים.</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-ink-700 mb-2">ניסיון</div>
          <Select value={exp} onChange={(e) => setExp(e.target.value as "all" | "yes" | "no")}>
            <option value="all">כולן</option>
            <option value="yes">מנוסות בלבד</option>
            <option value="no">ג׳וניוריות בלבד</option>
          </Select>
          <p className="text-[12px] text-ink-400 mt-2">
            בלי סימון קריטריונים — כל החברות הפעילות נכללות.
          </p>
        </div>
      </div>

      {/* Audience preview */}
      <div className="border border-ink-200 rounded-md p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Users size={15} className="text-brand-purple" />
          <span className="font-display text-sm font-bold text-ink-1000">
            קהל היעד: {selectedCount} חברות נבחרו
          </span>
          {previewing && <Loader2 size={14} className="animate-spin text-ink-400" />}
        </div>
        {audience === null ? (
          <p className="text-ink-500 text-sm py-1">טוענת את הקהל המתאים…</p>
        ) : audience.length === 0 ? (
          <p className="text-ink-500 text-sm py-1">
            אין חברות שמתאימות לקריטריונים — אפשר להרחיב אותם או להוסיף ידנית למטה.
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
                      <span className="font-medium text-ink-900">{m.full_name}</span>
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
        <div className="text-xs font-semibold text-ink-700 mb-2">
          הוספת חברה נוספת (מעבר לקריטריונים)
        </div>
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
          {publishing ? "מפרסמת ושולחת מיילים…" : `פרסום המשרה ל־${selectedCount} חברות`}
        </Button>
        <span className="text-[12px] text-ink-500">
          הפרסום פותח את המשרה לקהל שנבחר ושולח לכל אחת מייל אישי.
        </span>
      </div>
    </div>
  );
}
