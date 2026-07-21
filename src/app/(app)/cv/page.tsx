import type { Metadata } from "next";
import { Download, FileText, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { CvUploadForm } from "@/components/patterns/cv-upload-form";
import { deleteCv } from "./actions";
import type { CvLanguage } from "@/types/database";

export const metadata: Metadata = { title: "קורות החיים שלך" };

const LANG: Record<CvLanguage, { label: string; variant: "pink" | "purple" | "indigo" }> = {
  he: { label: "עברית", variant: "pink" },
  en: { label: "אנגלית", variant: "purple" },
  job: { label: "מותאם למשרה", variant: "indigo" },
};

export default async function CvPage() {
  const supabase = await createClient();
  const user = await getUser();

  const { data: docs } = await supabase
    .from("cv_documents")
    .select("id, label, language, file_path, file_name, created_at")
    .order("created_at", { ascending: false });

  // Signed URLs for downloads (private bucket).
  const signed = new Map<string, string>();
  for (const d of docs ?? []) {
    const { data } = await supabase.storage.from("cvs").createSignedUrl(d.file_path, 3600);
    if (data?.signedUrl) signed.set(d.id, data.signedUrl);
  }

  void user; // (RLS scopes the query to the current member.)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קורות חיים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">קורות החיים שלך</h1>
        <p className="t-body-sm text-ink-700">
          שמרי כאן את הגרסאות שלך — עברית, אנגלית, או מותאמות למשרה ספציפית. הקבצים פרטיים ונגישים רק לך ולצוות.
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
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900 truncate">{d.label}</div>
                    <div className="text-[11px] text-ink-500 truncate">{d.file_name}</div>
                  </div>
                  <Badge variant={lang.variant}>{lang.label}</Badge>
                  {signed.get(d.id) && (
                    <a
                      href={signed.get(d.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-500 hover:text-brand-purple"
                      title="הורדה"
                    >
                      <Download size={17} />
                    </a>
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
    </div>
  );
}
