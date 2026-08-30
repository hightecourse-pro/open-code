import { FileText, Link2, ListChecks, Play } from "lucide-react";
import { ContentLinksEditor } from "@/components/patterns/content-links-editor";
import {
  setSessionOpenToAll,
  setSessionRecording,
  updateSessionFiles,
} from "@/app/(admin)/admin/content/actions";
import type { ContentLink } from "@/types/database";

/**
 * Everything a session TEACHES, managed on the session itself (the owner,
 * 2026-08-30: the content-management session tools move here): the recording
 * link, an UPLOADED syllabus, materials (link or file), the topics to know
 * before the session, the open-to-all switch, and the full links editor.
 * Server component — rendered by the page and slotted into the client list.
 */
export function SessionContentPanel({
  session,
  links,
}: {
  session: {
    id: string;
    open_to_all: boolean;
    syllabus_url: string | null;
    materials_url: string | null;
    pre_topics: string | null;
  };
  links: ContentLink[];
}) {
  const recording = links.find((l) => l.kind === "video") ?? null;
  return (
    <div className="mt-2 rounded-md border border-ink-200 bg-white p-3.5 flex flex-col gap-4">
      {/* recording — the one-field shortcut */}
      <form action={setSessionRecording.bind(null, session.id)} className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900 w-32">
          <Play size={13} className="text-brand-pink-deep" /> קישור הקלטה
        </span>
        <input
          name="recording_url"
          dir="ltr"
          defaultValue={recording?.url ?? ""}
          placeholder="קישור Drive להקלטה…"
          className="flex-1 min-w-[220px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
        />
        <button type="submit" className="text-[12px] font-semibold text-white bg-brand-gradient rounded-md px-3 py-1.5">
          שמירה
        </button>
        <span className="text-[11px] text-ink-400 w-full">ריקון השדה מסיר את ההקלטה מהחברות.</span>
      </form>

      {/* syllabus (file) + materials (link/file) + pre-topics */}
      <form action={updateSessionFiles.bind(null, session.id)} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900 w-32">
            <FileText size={13} className="text-brand-purple" /> סילבוס (קובץ)
          </span>
          <input type="file" name="syllabus_file" accept=".pdf,.doc,.docx" className="text-[12px]" />
          {session.syllabus_url && (
            <>
              <a
                href={session.syllabus_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-semibold text-brand-purple hover:underline"
              >
                הקובץ הנוכחי ↗
              </a>
              <label className="inline-flex items-center gap-1 text-[12px] text-ink-500">
                <input type="checkbox" name="clear_syllabus" value="1" /> מחיקת הסילבוס
              </label>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900 w-32">
            <Link2 size={13} className="text-brand-indigo" /> חומרים
          </span>
          <input
            name="materials_url"
            dir="ltr"
            defaultValue={session.materials_url ?? ""}
            placeholder="קישור לחומרים…"
            className="flex-1 min-w-[180px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <span className="text-[11.5px] text-ink-400">או קובץ:</span>
          <input type="file" name="materials_file" className="text-[12px] max-w-48" />
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900 w-32 mt-1.5">
            <ListChecks size={13} className="text-[#8C5E0E]" /> נושאים לפני
          </span>
          <textarea
            name="pre_topics"
            defaultValue={session.pre_topics ?? ""}
            rows={2}
            maxLength={2000}
            placeholder="מה כדאי להכיר לפני הסשן? מוצג לחברות רק עד תחילת הסשן."
            className="flex-1 min-w-[220px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="text-[12px] font-semibold text-white bg-brand-gradient rounded-md px-3.5 py-1.5 w-fit">
            שמירת תוכן הסשן
          </button>
          <span className="text-[11px] text-ink-400">
            הסילבוס מוצג לחברות רק אם הועלה — ונשאר גם אחרי שההקלטה עולה.
          </span>
        </div>
      </form>

      {/* open to all + the full links editor (moved from ניהול תכנים) */}
      <div className="border-t border-ink-100 pt-3 flex flex-col gap-2">
        <form action={setSessionOpenToAll.bind(null, session.id, !session.open_to_all)}>
          <button
            type="submit"
            className={
              "text-[12px] font-semibold rounded-full px-3 py-1 border " +
              (session.open_to_all
                ? "bg-tint-mint text-[#0F6E4A] border-[#BFE4D1]"
                : "bg-ink-50 text-ink-700 border-ink-200 hover:border-brand-purple")
            }
          >
            {session.open_to_all ? "פתוח לכל הקהילה ✓ (לחיצה סוגרת למנויות)" : "פתיחה לכל הקהילה"}
          </button>
        </form>
        <ContentLinksEditor ownerType="session" ownerId={session.id} links={links} />
      </div>
    </div>
  );
}
