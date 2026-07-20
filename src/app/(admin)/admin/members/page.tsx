import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  MembersTable,
  type MemberRow,
  type FilterDef,
} from "@/components/patterns/members-table";
import { getTaxonomyOptions } from "@/lib/taxonomies";
import {
  LANGUAGE_SKILLS_KEY,
  LANG_LEVELS,
  langLevelLabel,
  parseLangSkills,
} from "@/lib/language-skills";

export const metadata: Metadata = { title: "ניהול חברות" };

type Opt = { value: string; label: string };
type AnswerRow = { profile_id: string; question_id: string; value: unknown };

/** Every answer row, paginated past PostgREST's silent 1000-row cap. */
async function fetchAllAnswers(): Promise<AnswerRow[]> {
  const admin = createAdminClient();
  const out: AnswerRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("profile_answers")
      .select("profile_id, question_id, value")
      .order("profile_id", { ascending: true })
      .order("question_id", { ascending: true })
      .range(from, from + PAGE - 1);
    out.push(...((data ?? []) as AnswerRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export default async function AdminMembersPage() {
  // The (admin) layout gates too — this is defense-in-depth for a page that
  // serializes every member's answers into the client payload.
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: members }, { data: questions }, { data: crm }, answers, taxonomyOptions] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("config_questions")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      // VIP + notes live in the admin-only member_crm table (empty pre-migration).
      supabase.from("member_crm").select("profile_id, is_vip, vip_reason, internal_notes"),
      fetchAllAnswers(),
      getTaxonomyOptions(),
    ]);

  const crmOf = new Map((crm ?? []).map((c) => [c.profile_id, c]));

  // question_id → member answers, grouped per member for client-side filtering.
  const answersByMember: Record<string, Record<string, unknown>> = {};
  for (const a of answers ?? []) {
    (answersByMember[a.profile_id] ??= {})[a.question_id] = a.value;
  }

  // Build a filter definition for every profile parameter.
  const filterDefs: FilterDef[] = [];
  for (const q of questions ?? []) {
    if (q.key === LANGUAGE_SKILLS_KEY) {
      // Chips per language seen in the data: "any level" + each specific level.
      const byLang = new Map<string, Set<string>>();
      for (const a of answers ?? []) {
        if (a.question_id !== q.id) continue;
        for (const s of parseLangSkills(a.value)) {
          let levels = byLang.get(s.lang);
          if (!levels) {
            levels = new Set();
            byLang.set(s.lang, levels);
          }
          levels.add(s.level);
        }
      }
      // Stable chip order: languages alphabetically, levels native→fluent→rw.
      const levelOrder = new Map(LANG_LEVELS.map((l, i) => [l.value, i]));
      const options: Opt[] = [];
      for (const [lang, levels] of [...byLang.entries()].sort((a, b) =>
        a[0].localeCompare(b[0], "he")
      )) {
        options.push({ value: `${lang}::*`, label: `${lang} · כל רמה` });
        const sorted = [...levels]
          .filter((lvl) => !lvl.includes("::"))
          .sort((a, b) => (levelOrder.get(a) ?? 99) - (levelOrder.get(b) ?? 99));
        for (const lvl of sorted) {
          options.push({ value: `${lang}::${lvl}`, label: `${lang} · ${langLevelLabel(lvl)}` });
        }
      }
      filterDefs.push({ id: q.id, label: q.label_he, type: "language", options });
      continue;
    }

    if (q.field_type === "bool") {
      filterDefs.push({
        id: q.id,
        label: q.label_he,
        type: "choice",
        options: [
          { value: "true", label: "כן" },
          { value: "false", label: "לא" },
        ],
      });
      continue;
    }

    if (q.field_type === "select" || q.field_type === "multiselect" || q.field_type === "tags") {
      const defined: Opt[] = q.taxonomy_kind
        ? taxonomyOptions[q.taxonomy_kind] ?? []
        : Array.isArray(q.options)
          ? (q.options as unknown as Opt[])
          : [];
      const known = new Set(defined.map((o) => o.value));
      // Free-text values ("אחר") found in real answers become chips too.
      const free = new Set<string>();
      for (const a of answers ?? []) {
        if (a.question_id !== q.id) continue;
        const vals = Array.isArray(a.value) ? a.value : [a.value];
        for (const v of vals) {
          if (typeof v === "string" && v && !known.has(v) && v !== "other") free.add(v);
        }
      }
      const options = [
        ...defined.filter((o) => o.value !== "other"),
        ...[...free].map((v) => ({ value: v, label: v })),
      ];
      if (options.length > 0) {
        filterDefs.push({ id: q.id, label: q.label_he, type: "choice", options });
      }
      continue;
    }

    if (q.field_type === "number") {
      const seen = new Set<number>();
      for (const a of answers ?? []) {
        if (a.question_id === q.id && typeof a.value === "number") seen.add(a.value);
      }
      if (seen.size > 0) {
        filterDefs.push({
          id: q.id,
          label: q.label_he,
          type: "choice",
          options: [...seen].sort((x, y) => x - y).map((n) => ({ value: String(n), label: String(n) })),
        });
      }
      continue;
    }

    // Free-text fields filter by "contains".
    filterDefs.push({ id: q.id, label: q.label_he, type: "text", options: [] });
  }

  const rows: MemberRow[] = (members ?? []).map((m) => {
    const c = crmOf.get(m.id);
    return {
      id: m.id,
      full_name: m.full_name,
      avatar_initials: m.avatar_initials,
      role: m.role,
      status: m.status,
      specialization: m.specialization,
      region: m.region,
      // Pre-migration fallback: the deprecated profiles columns.
      is_vip: c?.is_vip ?? m.is_vip ?? false,
      vip_reason: c?.vip_reason ?? null,
      internal_notes: c?.internal_notes ?? m.internal_notes ?? null,
      created_at: m.created_at,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;חברות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול חברות</h1>
        <p className="t-body-sm text-ink-500">
          חיפוש וסינון מיידיים, איתור חברות לפי כל שדה בפרופיל, סימון VIP והערות פנימיות.
        </p>
      </div>

      <MembersTable members={rows} filterDefs={filterDefs} answersByMember={answersByMember} />
    </div>
  );
}
