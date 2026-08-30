import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasUsableKey } from "@/lib/ai/keys";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { AiKeyBanner } from "@/components/patterns/ai-key-banner";
import { CvCheckerForm } from "@/components/patterns/cv-checker-form";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";

export const metadata: Metadata = { title: "בודקת קורות חיים" };

// The analysis rides through Google's 503 storms (model chain + waits between
// retry rounds) — the default function window cuts that journey short.
export const maxDuration = 120;

export default async function CvCheckerPage() {
  const profile = await requireCommunityAccess();
  if (!isSubscriber(profile)) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;כלי AI/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בודקת קורות חיים</h1>
          <p className="t-body-sm text-ink-700">
            ניתוח חכם של קורות החיים שלך, עם תובנות מעשיות והתאמה למשרה מסוימת.
          </p>
        </div>
        <UpgradeCard
          mentorWaiting={profile.role === "mentor"}
          title="כלי ה-AI נפתחים עם מנוי"
          body="בודקת קורות החיים נותנת לך משוב מפורט על הקו״ח שלך ובודקת התאמה למשרה — הכול נפתח עם מנוי לקהילה."
        />
      </div>
    );
  }

  // Her saved CVs feed the "no re-upload" path. The tool reads PDFs only, so
  // Word documents are left out here rather than failing at analysis time.
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("cv_documents")
    .select("id, label, file_name, is_default")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  const savedCvs = (docs ?? [])
    .filter((d) => /\.pdf$/i.test(d.file_name ?? ""))
    .map((d) => ({ id: d.id, label: d.label ?? d.file_name, isDefault: d.is_default === true }));

  const hasKey = await hasUsableKey();

  // Past AI reviews — the score history, each linked to the document it ran
  // on (the owner, 30/8: "לשמור היסטוריית חוות דעת... יחד עם לינק למסמך").
  const { data: pastReviews } = await supabase
    .from("cv_reviews")
    .select("id, created_at, score, summary, cv_document_id")
    .eq("profile_id", profile.id)
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(12);
  const historyDocNames = new Map<string, string>();
  {
    const docIds = [...new Set((pastReviews ?? []).map((r) => r.cv_document_id).filter((v): v is string => !!v))];
    if (docIds.length) {
      const { data: hd } = await supabase.from("cv_documents").select("id, label, file_name").in("id", docIds);
      for (const d of hd ?? []) historyDocNames.set(d.id, d.label ?? d.file_name ?? "מסמך");
    }
  }
  const HIST_DATE = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });

  return (
    <div className="flex flex-col gap-5">
      <AiKeyBanner hasKey={hasKey} next="/ai/cv-checker" />
      <CvCheckerForm savedCvs={savedCvs} />

      {(pastReviews ?? []).length > 0 && (
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h2 className="font-display text-base font-bold text-ink-1000 mb-3">הבדיקות הקודמות שלך</h2>
          <div className="flex flex-col">
            {(pastReviews ?? []).map((r) => (
              <div key={r.id} className="py-2.5 border-b border-ink-100 last:border-b-0 flex items-start gap-3 flex-wrap">
                <span
                  className="w-10 h-10 rounded-full bg-brand-gradient-soft flex items-center justify-center font-display font-black text-[14px] text-brand-purple shrink-0"
                  title="הציון שניתן"
                >
                  {r.score ?? "—"}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[12.5px] text-ink-500 flex items-center gap-2 flex-wrap">
                    <span suppressHydrationWarning>{HIST_DATE.format(new Date(r.created_at))}</span>
                    {r.cv_document_id && (
                      <>
                        <span>·</span>
                        <a href="/cv" className="font-semibold text-brand-purple hover:underline">
                          {historyDocNames.get(r.cv_document_id) ?? "המסמך"} ↗
                        </a>
                      </>
                    )}
                    {!r.cv_document_id && <span className="text-ink-400">· קובץ שהועלה ישירות</span>}
                  </div>
                  {r.summary && <p className="text-[13px] text-ink-900 mt-0.5 line-clamp-2">{r.summary}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
