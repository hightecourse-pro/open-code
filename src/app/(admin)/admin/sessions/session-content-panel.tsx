import { FileText, FolderOpen, ListChecks, Play, Trash2 } from "lucide-react";
import { SaveButton } from "@/components/patterns/save-button";
import {
  addSessionMaterial,
  addSessionVideo,
  clearSessionLegacyMaterials,
  deleteContentLink,
  setSessionOpenToAll,
  updateSessionFiles,
} from "@/app/(admin)/admin/content/actions";
import type { ContentLink } from "@/types/database";

/**
 * Everything a session TEACHES, managed on the session itself — reorganized
 * (the owner, 31/8: "תארגן מחדש את עריכת הסשן בצורה נוחה") into four clear
 * sections: recordings, syllabus + pre-topics, materials, sharing. One list
 * per kind, every row deletable in place — the generic links editor that
 * duplicated all of this is gone.
 */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900">
          {icon} {title}
        </span>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function LinkRow({
  title,
  url,
  onDeleteAction,
}: {
  title: string;
  url: string;
  onDeleteAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] bg-ink-50/60 border border-ink-100 rounded-md px-2.5 py-1.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-brand-purple hover:underline truncate max-w-[45%]"
      >
        {title}
      </a>
      <span className="text-ink-400 truncate flex-1" dir="ltr">
        {url}
      </span>
      <form action={onDeleteAction}>
        <button type="submit" className="text-ink-400 hover:text-danger cursor-pointer" title="מחיקה">
          <Trash2 size={13} />
        </button>
      </form>
    </div>
  );
}

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
  const recordings = links.filter((l) => l.kind === "video");
  const materials = links.filter((l) => l.kind === "materials");
  return (
    <div className="mt-2 rounded-md border border-ink-200 bg-white p-4 flex flex-col gap-4 divide-y divide-ink-100 [&>section]:pt-4 [&>section:first-child]:pt-0">
      {/* 1 ─ recordings: the list + add */}
      <Section
        icon={<Play size={13} className="text-brand-pink-deep" />}
        title="הקלטות"
        hint="כל שורה היא כפתור צפייה אצל החברות; מחיקה מסירה מיד."
      >
        {recordings.map((r) => (
          <LinkRow key={r.id} title={r.title} url={r.url} onDeleteAction={deleteContentLink.bind(null, r.id)} />
        ))}
        <form action={addSessionVideo.bind(null, session.id)} className="flex flex-wrap items-center gap-2">
          <input
            name="url"
            dir="ltr"
            placeholder="קישור Drive להקלטה…"
            className="flex-1 min-w-[220px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <input
            name="note"
            placeholder="כותרת (אופציונלי)"
            maxLength={120}
            className="w-40 text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <SaveButton label="הוספת הקלטה" />
        </form>
      </Section>

      {/* 2 ─ syllabus file + pre-topics (one save) */}
      <Section
        icon={<FileText size={13} className="text-brand-purple" />}
        title="סילבוס ונושאים"
        hint="הסילבוס נשאר גם אחרי שההקלטה עולה; הנושאים מוצגים רק עד תחילת הסשן."
      >
        <form action={updateSessionFiles.bind(null, session.id)} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-700 w-28 shrink-0">סילבוס (קובץ):</span>
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
                <label className="inline-flex items-center gap-1 text-[12px] text-ink-500 cursor-pointer">
                  <input type="checkbox" name="clear_syllabus" value="1" /> למחוק את הקובץ
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-[12px] text-ink-700 w-28 shrink-0 mt-1.5 inline-flex items-center gap-1">
              <ListChecks size={12} className="text-[#8C5E0E]" /> נושאים לפני:
            </span>
            <textarea
              name="pre_topics"
              defaultValue={session.pre_topics ?? ""}
              rows={2}
              maxLength={2000}
              placeholder="מה כדאי להכיר לפני הסשן?"
              className="flex-1 min-w-[220px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
            />
          </div>
          <SaveButton label="שמירה" className="self-start" />
        </form>
      </Section>

      {/* 3 ─ materials: list + add + the legacy link (now deletable too) */}
      <Section
        icon={<FolderOpen size={13} className="text-brand-indigo" />}
        title="חומרים"
        hint="קישור או קובץ, עם הסבר קצר שיוצג לחברות."
      >
        {materials.map((m) => (
          <LinkRow key={m.id} title={m.title} url={m.url} onDeleteAction={deleteContentLink.bind(null, m.id)} />
        ))}
        {session.materials_url && (
          <div className="flex items-center gap-2 text-[12.5px] bg-tint-warm/40 border border-[#EAD9B0] rounded-md px-2.5 py-1.5">
            <span className="font-semibold text-[#8C5E0E] shrink-0">קישור ישן:</span>
            <a
              href={session.materials_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-purple hover:underline truncate flex-1"
              dir="ltr"
            >
              {session.materials_url}
            </a>
            <form action={clearSessionLegacyMaterials.bind(null, session.id)}>
              <button type="submit" className="text-ink-400 hover:text-danger cursor-pointer" title="מחיקת הקישור הישן">
                <Trash2 size={13} />
              </button>
            </form>
          </div>
        )}
        <form action={addSessionMaterial.bind(null, session.id)} className="flex flex-wrap items-center gap-2">
          <input
            name="note"
            placeholder="הסבר (אופציונלי)"
            maxLength={120}
            className="w-44 text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <input
            name="url"
            dir="ltr"
            placeholder="קישור…"
            className="flex-1 min-w-[160px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <span className="text-[11.5px] text-ink-400">או קובץ:</span>
          <input type="file" name="file" className="text-[12px] max-w-44" />
          <SaveButton label="הוספה" />
        </form>
      </Section>

      {/* 4 ─ sharing */}
      <Section icon={<span aria-hidden>🔓</span>} title="שיתוף">
        <form action={setSessionOpenToAll.bind(null, session.id, !session.open_to_all)}>
          <button
            type="submit"
            className={
              "text-[12px] font-semibold rounded-full px-3 py-1 border cursor-pointer " +
              (session.open_to_all
                ? "bg-tint-mint text-[#0F6E4A] border-[#BFE4D1]"
                : "bg-ink-50 text-ink-700 border-ink-200 hover:border-brand-purple")
            }
          >
            {session.open_to_all ? "פתוח לכל הקהילה ✓ (לחיצה סוגרת למנויות)" : "פתיחה לכל הקהילה"}
          </button>
        </form>
      </Section>
    </div>
  );
}
