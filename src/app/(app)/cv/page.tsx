import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, FileText, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { CvUploadForm } from "@/components/patterns/cv-upload-form";
import { CvName } from "@/components/patterns/cv-name";
import { deleteCv, setDefaultCv } from "./actions";
import type { CvLanguage } from "@/types/database";
import { CvPreviewButton } from "@/components/patterns/cv-preview";
import { GradeSheetUploadForm } from "@/components/patterns/grade-sheet-upload-form";
import { deleteGradeSheet } from "./grades-actions";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = { title: "קורות החיים שלך" };

const LANG: Record<CvLanguage, { label: string; variant: "pink" | "purple" | "indigo" }> = {
  he: { label: "עברית", variant: "pink" },
  en: { label: "אנגלית", variant: "purple" },
  job: { label: "מותאם למשרה", variant: "indigo" },
};

export default async function CvPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) redirect("/login");

  // Filtered to her own rows explicitly, not just via RLS — an admin's RLS
  // grants read on everyone's documents, which put the whole community's CVs
  // (each with its owner's default badge) on this personal screen.
  // is_default arrives with supabase/_cv_default.sql — until it runs, the page
  // still lists her files (without the marker) instead of erroring.
  const withDefault = await supabase
    .from("cv_documents")
    .select("id, label, language, file_path, file_name, created_at, is_default")
    .eq("profile_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  const docs = withDefault.error
    ? (
        await supabase
          .from("cv_documents")
          .select("id, label, language, file_path, file_name, created_at")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false })
      ).data?.map((d) => ({ ...d, is_default: false }))
    : withDefault.data;
  const canMarkDefault = !withDefault.error;

  // Signed URLs for downloads (private bucket).
  const signed = new Map<string, string>();
  for (const d of docs ?? []) {
    const { data } = await supabase.storage.from("cvs").createSignedUrl(d.file_path, 3600);
    if (data?.signedUrl) signed.set(d.id, data.signedUrl);
  }

  // Grade sheets (the owner, 19/9) — juniors only; optional, hers to manage.
  const { data: me } = await supabase.from("profiles").select("role, is_experienced").eq("id", user.id).maybeSingle();
  const juniorTrack = me?.role === "junior" && me.is_experienced !== true;
  const { data: grades } = juniorTrack
    ? await supabase.from("grade_sheets").select("id, label, file_path, file_name, created_at").eq("profile_id", user.id).order("created_at", { ascending: false })
    : { data: [] as { id: string; label: string; file_path: string; file_name: string; created_at: string }[] };
  const gradeUrls = new Map<string, string>();
  for (const g of grades ?? []) {
    const { data } = await supabase.storage.from("cvs").createSignedUrl(g.file_path, 3600);
    if (data?.signedUrl) gradeUrls.set(g.id, data.signedUrl);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קורות חיים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">קורות החיים שלך</h1>
        <p className="t-body-sm text-ink-700">
          שמרי כאן את הגרסאות שלך — עברית, אנגלית, או מותאמות למשרה ספציפית. הקבצים פרטיים ונגישים רק לך ולצוות.
          {canMarkDefault && " הקובץ שסימנת כברירת מחדל הוא זה שיצורף אוטומטית להגשות שלך."}
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-3">העלאת קובץ חדש</h2>
        <CvUploadForm />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-3">הקבצים שלי</h2>
        {docs && docs.length > 0 ? (
          <div className="flex flex-col">
            {docs.map((d) => {
              const lang = LANG[d.language];
              return (
                <div key={d.id} className="flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0">
                  <FileText size={18} className="text-brand-purple shrink-0" />
                  <CvName id={d.id} label={d.label} fileName={d.file_name ?? ""} />
                  <Badge variant={lang.variant}>{lang.label}</Badge>
                  {canMarkDefault &&
                    (d.is_default ? (
                      <Badge variant="mint">ברירת מחדל</Badge>
                    ) : (
                      <form action={setDefaultCv.bind(null, d.id)}>
                        <button
                          type="submit"
                          className="text-[12px] font-semibold text-brand-purple hover:text-brand-pink-deep whitespace-nowrap cursor-pointer"
                        >
                          הפכי לברירת מחדל
                        </button>
                      </form>
                    ))}
                  {signed.get(d.id) && (
                    <>
                      <CvPreviewButton compact url={signed.get(d.id)!} fileName={d.file_name} title={d.label} />
                      <a
                        href={signed.get(d.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-500 hover:text-brand-purple"
                        title="הורדה"
                      >
                        <Download size={17} />
                      </a>
                    </>
                  )}
                  <ConfirmActionButton
                    action={deleteCv.bind(null, d.id)}
                    message={`למחוק את "${d.label}"? אי אפשר לשחזר את הקובץ.`}
                    title="מחיקה"
                    className="text-ink-400 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </ConfirmActionButton>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">עדיין לא העלית קבצים. אפשר להתחיל למעלה 💜</p>
        )}
      </div>

      {juniorTrack && (
        <div id="grades" className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm scroll-mt-4">
          <h2 className="font-display text-lg font-bold text-ink-1000 mb-1 flex items-center gap-2">
            <GraduationCap size={18} className="text-brand-indigo" /> גליונות ציונים
          </h2>
          <p className="text-[12.5px] text-ink-500 mb-4">
            לא חובה — אבל גליון ציונים עוזר לנו להציג אותך למעסיקים בצורה מלאה יותר. הקבצים פרטיים ונגישים רק לך ולצוות.
          </p>
          <GradeSheetUploadForm />
          {(grades ?? []).length > 0 && (
            <div className="flex flex-col mt-5 border-t border-ink-100 pt-2">
              {(grades ?? []).map((g) => (
                <div key={g.id} className="flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0">
                  <GraduationCap size={18} className="text-brand-indigo shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900 truncate">{g.label}</div>
                    <div className="text-xs text-ink-500 truncate" dir="ltr">
                      {g.file_name} · {new Date(g.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  {gradeUrls.get(g.id) && (
                    <>
                      <CvPreviewButton compact url={gradeUrls.get(g.id)!} fileName={g.file_name} title={g.label} />
                      <a href={gradeUrls.get(g.id)} target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:text-brand-purple" title="הורדה">
                        <Download size={17} />
                      </a>
                    </>
                  )}
                  <ConfirmActionButton
                    action={deleteGradeSheet.bind(null, g.id)}
                    message={`למחוק את "${g.label}"?`}
                    title="מחיקה"
                    className="text-ink-400 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </ConfirmActionButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
