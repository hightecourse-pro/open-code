import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  MembersTable,
  type MemberRow,
  type FilterDef,
} from "@/components/patterns/members-table";
import { ManualHiresCard, type ManualHireRow } from "@/components/patterns/manual-hires-card";
import { getTaxonomyOptions } from "@/lib/taxonomies";
import {
  LANGUAGE_SKILLS_KEY,
  LANG_LEVELS,
  langLevelLabel,
  parseLangSkills,
} from "@/lib/language-skills";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "ניהול חברות" };

type Opt = { value: string; label: string };
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Every member, paged past PostgREST's silent 1000-row cap — at 3,000 members
 * an un-ranged select quietly showed only the newest 1000 and made the rest
 * unfindable. Profile rows are small; the answers no longer ride along at all
 * (the candidate finder matches them in SQL, on demand).
 */
async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const out: ProfileRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_initials, role, status, specialization, region, is_experienced, is_vip, internal_notes, created_at, profile_completed"
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    out.push(...((data ?? []) as unknown as ProfileRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // The dashboard cubes deep-link here pre-filtered (?status=active/pending).
  const { status: statusParam } = await searchParams;
  const initialStatus = ["active", "pending", "paused", "rejected"].includes(statusParam ?? "")
    ? statusParam!
    : "";
  await requireRole("admin");
  const supabase = await createClient();
  const admin = createAdminClient();

  const [members, { data: questions }, { data: crm }, { data: manualHires }, taxonomyOptions] =
    await Promise.all([
      fetchAllProfiles(),
      supabase
        .from("config_questions")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      // VIP + notes live in the admin-only member_crm table (empty pre-migration).
      supabase.from("member_crm").select("profile_id, is_vip, vip_reason, internal_notes"),
      // Off-community placements for the forum banner (admin-only table).
      supabase
        .from("manual_hires")
        .select("id, full_name, hired_at")
        .order("hired_at", { ascending: false }),
      getTaxonomyOptions(),
    ]);

  const crmOf = new Map((crm ?? []).map((c) => [c.profile_id, c]));

  // Contact details per row (the owner, 1/9): emails from auth (paged — the
  // default listUsers page is 50), phones from the phone answer.
  const emailOf = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data: authPage } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of authPage?.users ?? []) if (u.email) emailOf.set(u.id, u.email);
    if (!authPage || authPage.users.length < 1000) break;
  }
  const phoneQ = (questions ?? []).find((q) => q.key === "phone");
  const phoneOf = new Map<string, string>();
  if (phoneQ) {
    const { data: phones } = await admin
      .from("profile_answers")
      .select("profile_id, value")
      .eq("question_id", phoneQ.id)
      .limit(5000);
    for (const p of phones ?? []) {
      if (typeof p.value === "string" && p.value) phoneOf.set(p.profile_id, p.value);
    }
  }
  // Payment state per member — for the Excel export (the owner, 1/9):
  // a live subscription (with its renewal date), or presence on the imported
  // Nedarim payers list, or nothing.
  const DATE_IL = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Jerusalem" });
  const [{ data: liveSubs }, { data: extPays }, { data: failedPays }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("profile_id, status, current_period_end, canceled_at")
      .in("status", ["active", "trialing"]),
    admin.from("external_payments").select("email, claimed_by, needs_review").eq("needs_review", false),
    // Refused charges reported by Nedarim (the owner, 31/8: "היה לה סירוב,
    // זה לא מתועד") — the newest refusal rides the payment column.
    admin
      .from("payments")
      .select("profile_id, created_at, raw")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const subOf = new Map((liveSubs ?? []).map((s) => [s.profile_id, s]));
  const payerEmails = new Set((extPays ?? []).map((e) => (e.email ?? "").toLowerCase()).filter(Boolean));
  const claimedBy = new Set((extPays ?? []).map((e) => e.claimed_by).filter(Boolean));
  const failOf = new Map<string, { at: string; msg: string }>();
  for (const f of failedPays ?? []) {
    if (failOf.has(f.profile_id)) continue; // newest first — keep it
    const raw = (f.raw ?? {}) as Record<string, string>;
    failOf.set(f.profile_id, {
      at: String(raw.ErrorTime ?? "").split(" ")[0] || DATE_IL.format(new Date(f.created_at)),
      msg: String(raw.Message ?? "סירוב"),
    });
  }
  const paymentOf = (id: string): string => {
    const fail = failOf.get(id);
    const failNote = fail ? ` · ⚠️ חיוב סורב ${fail.at} (${fail.msg})` : "";
    const s = subOf.get(id);
    if (s) {
      const until = s.current_period_end ? ` עד ${DATE_IL.format(new Date(s.current_period_end))}` : "";
      return `מנוי פעיל${until}${s.canceled_at ? " (ביטלה חידוש)" : ""}${failNote}`;
    }
    const email = (emailOf.get(id) ?? "").toLowerCase();
    if (claimedBy.has(id) || (email && payerEmails.has(email))) return `ברשימת המשלמות של נדרים${failNote}`;
    return failNote ? failNote.replace(" · ", "") : "";
  };

  // Study place replaces the specialization column (the owner, 1/9) — stored
  // as the select's VALUE; resolve to the human label, free-typed אחר as-is.
  const studyQ = (questions ?? []).find((q) => q.key === "study_place");
  const studyOf = new Map<string, string>();
  if (studyQ) {
    const labelOf = new Map(
      (Array.isArray(studyQ.options) ? (studyQ.options as { value: string; label: string }[]) : []).map(
        (o) => [o.value, o.label]
      )
    );
    const { data: studies } = await admin
      .from("profile_answers")
      .select("profile_id, value")
      .eq("question_id", studyQ.id)
      .limit(5000);
    for (const s of studies ?? []) {
      if (typeof s.value === "string" && s.value) studyOf.set(s.profile_id, labelOf.get(s.value) ?? s.value);
    }
  }

  // Filter definitions come from the CONFIGURED options (taxonomies + the
  // question's own options). The one data-driven definition left is the
  // language chips — a single bounded query on that single question.
  const filterDefs: FilterDef[] = [];
  for (const q of questions ?? []) {
    if (q.key === LANGUAGE_SKILLS_KEY) {
      const { data: langAnswers } = await admin
        .from("profile_answers")
        .select("value")
        .eq("question_id", q.id)
        .limit(5000);
      const byLang = new Map<string, Set<string>>();
      for (const a of langAnswers ?? []) {
        for (const s of parseLangSkills(a.value)) {
          let levels = byLang.get(s.lang);
          if (!levels) {
            levels = new Set();
            byLang.set(s.lang, levels);
          }
          levels.add(s.level);
        }
      }
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
      const options = defined.filter((o) => o.value !== "other");
      if (options.length > 0) {
        filterDefs.push({ id: q.id, label: q.label_he, type: "choice", options });
      }
      continue;
    }

    // Numbers and free-text fields filter by "contains" — evaluated in SQL.
    filterDefs.push({ id: q.id, label: q.label_he, type: "text", options: [] });
  }

  const rows: MemberRow[] = members.map((m) => {
    const c = crmOf.get(m.id);
    return {
      id: m.id,
      full_name: m.full_name,
      avatar_initials: m.avatar_initials,
      role: m.role,
      is_experienced: m.is_experienced === true,
      status: m.status,
      specialization: m.specialization,
      region: m.region,
      // Pre-migration fallback: the deprecated profiles columns.
      is_vip: c?.is_vip ?? m.is_vip ?? false,
      vip_reason: c?.vip_reason ?? null,
      internal_notes: c?.internal_notes ?? m.internal_notes ?? null,
      created_at: m.created_at,
      email: emailOf.get(m.id) ?? null,
      phone: phoneOf.get(m.id) ?? null,
      profile_completed: m.profile_completed === true,
      study_place: studyOf.get(m.id) ?? null,
      payment: paymentOf(m.id),
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

      <MembersTable members={rows} filterDefs={filterDefs} initialStatus={initialStatus} />

      <ManualHiresCard
        hires={(manualHires ?? []) as ManualHireRow[]}
        defaultDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
