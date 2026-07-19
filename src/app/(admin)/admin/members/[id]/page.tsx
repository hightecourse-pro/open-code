import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, FileText, Mail, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { Avatar, Badge } from "@/components/ui";
import { StatusPill, RoleTag } from "@/components/patterns/member-tags";
import { MemberCrm } from "@/components/patterns/member-crm";
import { MemberActions } from "@/components/patterns/member-actions";
import { getTaxonomyOptions } from "@/lib/taxonomies";
import { LANGUAGE_SKILLS_KEY, langLevelLabel, parseLangSkills } from "@/lib/language-skills";
import type { ConfigQuestion } from "@/types/database";

export const metadata: Metadata = { title: "פרופיל חברה" };

const DIGEST_LABEL: Record<string, string> = {
  daily: "מייל יומי",
  unread: "רק כשיש הודעות שלא נקראו",
  off: "בלי מיילים",
};

const CV_LANG: Record<string, string> = {
  he: "עברית",
  en: "אנגלית",
  job: "מותאם למשרה",
};

export default async function AdminMemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Defense-in-depth beyond the (admin) layout — this page uses the service
  // role for the member's email and CV files.
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: questions }, { data: answers }, { data: crm }, taxonomyOptions] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("config_questions")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase.from("profile_answers").select("question_id, value").eq("profile_id", id),
      // VIP + notes live in the admin-only member_crm table (null pre-migration).
      supabase.from("member_crm").select("*").eq("profile_id", id).maybeSingle(),
      getTaxonomyOptions(),
    ]);

  if (!profile) notFound();
  const isVip = crm?.is_vip ?? profile.is_vip ?? false;
  const vipReason = crm?.vip_reason ?? null;
  const internalNotes = crm?.internal_notes ?? profile.internal_notes ?? null;

  // Contact email lives in auth, not in profiles.
  const adminClient = createAdminClient();
  let email: string | null = null;
  try {
    const { data: authUser } = await adminClient.auth.admin.getUserById(id);
    email = authUser?.user?.email ?? null;
  } catch {
    // best-effort
  }

  // Her CV files (owner-only under RLS → service role), with download links.
  const { data: cvDocs } = await adminClient
    .from("cv_documents")
    .select("id, label, language, file_path, file_name, created_at")
    .eq("profile_id", id)
    .order("created_at", { ascending: false });
  const { data: cvSigned } = (cvDocs ?? []).length
    ? await adminClient.storage
        .from("cvs")
        .createSignedUrls((cvDocs ?? []).map((d) => d.file_path), 3600)
    : { data: [] };
  const cvUrlOf = new Map((cvSigned ?? []).map((s) => [s.path, s.signedUrl]));

  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.value]));

  // Turn stored machine values back into the human labels the member picked.
  function labelsFor(q: ConfigQuestion): Map<string, string> {
    const opts = q.taxonomy_kind
      ? taxonomyOptions[q.taxonomy_kind] ?? []
      : Array.isArray(q.options)
        ? (q.options as unknown as { value: string; label: string }[])
        : [];
    return new Map(opts.map((o) => [o.value, o.label]));
  }
  function display(q: ConfigQuestion): string {
    const v = answerMap.get(q.id);
    if (v === undefined || v === null || v === "") return "—";
    if (q.key === LANGUAGE_SKILLS_KEY) {
      const skills = parseLangSkills(v);
      return skills.length
        ? skills.map((s) => `${s.lang} — ${langLevelLabel(s.level)}`).join(" · ")
        : "—";
    }
    const labels = labelsFor(q);
    if (Array.isArray(v)) {
      const items = (v as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((x) => labels.get(x) ?? x);
      return items.length ? items.join(" · ") : "—";
    }
    if (typeof v === "boolean") return v ? "כן" : "לא";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return labels.get(v) ?? v;
    return "—";
  }

  const answered = (questions ?? []).filter((q) => {
    const v = answerMap.get(q.id);
    return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline self-start"
      >
        <ArrowRight size={15} /> חזרה לניהול חברות
      </Link>

      {/* Header card */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex items-start gap-4 flex-wrap">
        <Avatar
          size="xl"
          tone={profile.role === "mentor" ? "gold" : "pink"}
          crown={profile.role === "mentor"}
          initials={profile.avatar_initials || profile.full_name.slice(0, 1) || "ק"}
        />
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-display text-[24px] font-black text-ink-1000">{profile.full_name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <RoleTag role={profile.role} />
            <StatusPill status={profile.status} />
            {isVip && (
              <span
                title={vipReason ? `VIP: ${vipReason}` : "VIP"}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8C5E0E] bg-tint-warm border border-[#F8D98C] px-2 py-0.5 rounded-full"
              >
                ⭐ VIP{vipReason ? ` · ${vipReason}` : ""}
              </span>
            )}
            {profile.is_experienced && <Badge variant="purple">עם ניסיון</Badge>}
            {profile.specialization && <Badge variant="tech">{profile.specialization}</Badge>}
          </div>
          <div className="text-[13px] text-ink-500 mt-2 flex flex-col gap-0.5">
            {email && (
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Mail size={13} /> {email}
              </span>
            )}
            <span>הצטרפה: {new Date(profile.created_at).toLocaleDateString("he-IL")}</span>
            <span>העדפת מייל: {DIGEST_LABEL[profile.digest_frequency] ?? profile.digest_frequency}</span>
          </div>
        </div>
        <MemberActions profileId={profile.id} status={profile.status} />
      </div>

      {/* Internal notes / CRM */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3 flex items-center gap-1.5">
          <StickyNote size={16} className="text-brand-purple" /> הערות פנימיות
        </h3>
        <MemberCrm id={profile.id} isVip={isVip} vipReason={vipReason} notes={internalNotes} />
      </div>

      {/* CV files */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3 flex items-center gap-1.5">
          <FileText size={16} className="text-brand-pink-deep" /> קורות חיים ({(cvDocs ?? []).length})
        </h3>
        {(cvDocs ?? []).length > 0 ? (
          <div className="flex flex-col">
            {(cvDocs ?? []).map((d) => {
              const url = cvUrlOf.get(d.file_path);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-ink-900">{d.label}</div>
                    <div className="text-xs text-ink-500">
                      {CV_LANG[d.language] ?? d.language} · הועלה{" "}
                      {new Date(d.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brand-gradient rounded-md px-3 py-1.5"
                    >
                      <Download size={13} /> הורדה
                    </a>
                  ) : (
                    <span className="text-[12px] text-ink-400">לא זמין</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">היא עדיין לא העלתה קורות חיים.</p>
        )}
      </div>

      {/* The full intake profile */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">תשובות הפרופיל</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          כל מה שהיא מילאה בטופס ההצטרפות ובפרופיל ({answered.length} שדות).
        </p>
        {answered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {answered.map((q) => (
              <div key={q.id} className="py-2.5 border-b border-ink-100">
                <div className="text-[11.5px] text-ink-500">{q.label_he}</div>
                <div className="text-[14px] text-ink-900 font-medium mt-0.5 break-words">
                  {display(q)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">היא עדיין לא השלימה את הפרופיל.</p>
        )}
      </div>
    </div>
  );
}
