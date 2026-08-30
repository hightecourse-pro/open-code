import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasUsableKey } from "@/lib/ai/keys";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { AiKeyBanner } from "@/components/patterns/ai-key-banner";
import { CvCheckerForm } from "@/components/patterns/cv-checker-form";
import { CvHistoryList } from "@/components/patterns/cv-history-list";
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
    .select("id, created_at, score, summary, cv_document_id, checked_file_path, insights, job_fit")
    .eq("profile_id", profile.id)
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(12);
  const historyDocNames = new Map<string, string>();
  const historyDocPaths = new Map<string, string>();
  {
    const docIds = [...new Set((pastReviews ?? []).map((r) => r.cv_document_id).filter((v): v is string => !!v))];
    if (docIds.length) {
      const { data: hd } = await supabase.from("cv_documents").select("id, label, file_name, file_path").in("id", docIds);
      for (const d of hd ?? []) {
        historyDocNames.set(d.id, d.label ?? d.file_name ?? "מסמך");
        if (d.file_path) historyDocPaths.set(d.id, d.file_path);
      }
    }
  }
  // Every entry opens the file it was checked against (the owner, 30/8):
  // direct uploads keep a snapshot in checked_file_path, saved documents go
  // through their cv_documents path. All under her own folder, so her own
  // storage policy signs them.
  const historyFileUrls = new Map<string, string>();
  {
    const paths = [
      ...new Set(
        (pastReviews ?? [])
          .map((r) => r.checked_file_path ?? (r.cv_document_id ? historyDocPaths.get(r.cv_document_id) : null))
          .filter((v): v is string => !!v)
      ),
    ];
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("cvs").createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.signedUrl && s.path) historyFileUrls.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AiKeyBanner hasKey={hasKey} next="/ai/cv-checker" />
      <CvCheckerForm savedCvs={savedCvs} />

      <CvHistoryList
        entries={(pastReviews ?? []).map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          score: r.score,
          summary: r.summary,
          docName: r.cv_document_id ? (historyDocNames.get(r.cv_document_id) ?? "המסמך") : null,
          fileUrl: (() => {
            const p = r.checked_file_path ?? (r.cv_document_id ? historyDocPaths.get(r.cv_document_id) : null);
            return p ? (historyFileUrls.get(p) ?? null) : null;
          })(),
          insights: Array.isArray(r.insights)
            ? (r.insights as { type: "good" | "warn" | "bad" | "tip"; title: string; detail: string }[])
            : [],
          jobFit: (r.job_fit ?? null) as { score: number; matched: string[]; missing: string[] } | null,
        }))}
      />
    </div>
  );
}
