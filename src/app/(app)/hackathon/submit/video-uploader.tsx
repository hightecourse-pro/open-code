"use client";

import { useActionState, useState, useTransition } from "react";
import { Clapperboard, Trash2, UploadCloud } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/hackathon-shared";
import { createVideoUpload, finalizeVideo, removeVideo, saveVideoUrl, type SubmitState } from "./actions";

/**
 * The one-minute video: a file straight to the private bucket (signed upload,
 * up to 50MB) or a link (YouTube / Drive / Loom). The owner (16/10): make it
 * clear it may be the one shown at the event and the one the judging is done
 * through.
 */
export function VideoUploader({ videoPath, videoSize, videoUrl }: { videoPath: string | null; videoSize: number | null; videoUrl: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [linkState, linkAction, linkPending] = useActionState<SubmitState, FormData>(saveVideoUrl, {});

  async function upload() {
    setError(null);
    setDone(null);
    if (!file) return setError("בחרי קובץ וידאו.");
    setProgress("פותחת העלאה…");
    const slot = await createVideoUpload(file.name, file.size);
    if (slot.error || !slot.token || !slot.path) {
      setProgress(null);
      return setError(slot.error ?? "שגיאה");
    }
    setProgress(`מעלה ${formatBytes(file.size)}…`);
    const { error: upErr } = await createClient().storage.from("hackathon").uploadToSignedUrl(slot.path, slot.token, file, { upsert: true });
    if (upErr) {
      setProgress(null);
      return setError(`ההעלאה נכשלה: ${upErr.message}`);
    }
    setProgress("רושמת…");
    const fin = await finalizeVideo(slot.path, file.size);
    setProgress(null);
    if (fin.error) return setError(fin.error);
    setDone(fin.info ?? "הועלה ✓");
    setFile(null);
  }

  const fileName = videoPath ? videoPath.split("/").pop()?.replace(/^\d+-/, "") : null;

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
      <div>
        <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// הסרטון"}</div>
        <h2 className="font-display text-[18px] font-black text-ink-1000 flex items-center gap-2">
          <Clapperboard size={18} className="text-brand-pink-deep" /> 4. סרטון קצר של עד דקה איך המערכת עובדת
        </h2>
        <p className="text-[13px] text-ink-700 mt-1 leading-relaxed">
          <b>לא יותר מדקה!</b> שיובן התהליך מקצה לקצה: הבעיה, הפתרון והתוצאה. ייתכן שזה הסרטון שיוצג באירוע ודרכו גם תתבצע הבדיקה - אז
          מסך אמיתי, בלי מצגות.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* the file */}
        <div className="rounded-[14px] border border-dashed border-brand-purple/40 bg-tint-purple/20 p-4 flex flex-col gap-2.5">
          <div className="text-[13px] font-semibold text-ink-800 flex items-center gap-1.5">
            <UploadCloud size={15} className="text-brand-purple" /> להעלות קובץ (mp4 / mov / webm, עד 50MB)
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-800 bg-white rounded-[10px] px-3 py-2 border border-ink-200">
              <span className="truncate flex-1" dir="ltr">
                🎬 {fileName}
              </span>
              {videoSize ? <span className="text-ink-500 shrink-0">{formatBytes(videoSize)}</span> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm("להסיר את הסרטון שהועלה?")) start(() => removeVideo().then(() => undefined));
                }}
                className="inline-flex items-center gap-1 text-[#B42318] hover:underline shrink-0"
              >
                <Trash2 size={12} /> הסרה
              </button>
            </div>
          )}
          <input
            type="file"
            accept=".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-[12.5px] text-ink-700 file:me-3 file:rounded-full file:border-0 file:bg-brand-gradient file:text-white file:font-bold file:px-3.5 file:py-1.5 file:text-[12.5px] cursor-pointer"
            aria-label="בחירת קובץ וידאו"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" size="sm" disabled={!file || !!progress} onClick={upload}>
              {progress ?? (fileName ? "להחליף את הסרטון" : "העלאה")}
            </Button>
            {done && <span className="text-[12.5px] font-bold text-success">{done}</span>}
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
        </div>

        {/* the link */}
        <form action={linkAction} className="rounded-[14px] border border-ink-200 bg-white p-4 flex flex-col gap-2.5">
          <div className="text-[13px] font-semibold text-ink-800">או קישור (יוטיוב / דרייב / Loom)</div>
          <span className="text-[12px] text-ink-500">ודאי שהקישור פתוח לצפייה לכל מי שיש לו אותו.</span>
          <Input name="video_url" type="url" dir="ltr" placeholder="https://youtu.be/…" defaultValue={videoUrl ?? ""} />
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="submit" size="sm" variant="secondary" disabled={linkPending}>
              {linkPending ? "שומרת…" : "שמירת הקישור"}
            </Button>
            {linkState.error && <Alert variant="danger">{linkState.error}</Alert>}
            {linkState.ok && <span className="text-[12.5px] font-bold text-success">{linkState.info}</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
