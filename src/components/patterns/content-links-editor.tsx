import { Trash2, Video, FolderOpen } from "lucide-react";
import { addContentLink, deleteContentLink } from "@/app/(admin)/admin/content/actions";
import type { ContentLink, ContentOwner } from "@/types/database";

/**
 * Admin editor for a course/session's Drive links. Each link is tagged as a
 * view-only video or a materials folder. Pure server component — every control
 * is a server-action form.
 */
export function ContentLinksEditor({
  ownerType,
  ownerId,
  links,
}: {
  ownerType: ContentOwner;
  ownerId: string;
  links: ContentLink[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 ? (
        <ul className="flex flex-col divide-y divide-ink-100">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-1.5">
              {l.kind === "video" ? (
                <Video size={15} className="text-brand-pink-deep shrink-0" />
              ) : (
                <FolderOpen size={15} className="text-brand-purple shrink-0" />
              )}
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-ink-900 hover:text-brand-purple truncate"
              >
                {l.title}
              </a>
              <span className="text-[10.5px] text-ink-400 shrink-0">
                {l.kind === "video" ? "סרטון (צפייה בלבד)" : "תיקיית חומרים"}
              </span>
              <form action={deleteContentLink.bind(null, l.id)} className="ms-auto shrink-0">
                <button type="submit" className="text-ink-400 hover:text-danger" title="מחיקה">
                  <Trash2 size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-400">אין עדיין קישורים.</p>
      )}

      <form
        action={addContentLink.bind(null, ownerType, ownerId)}
        className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100"
      >
        <select name="kind" defaultValue="video" className="text-[12px] border border-ink-300 rounded-md px-2 py-1.5">
          <option value="video">סרטון</option>
          <option value="materials">תיקיית חומרים</option>
        </select>
        <input
          name="title"
          placeholder="כותרת"
          required
          className="text-[12px] border border-ink-300 rounded-md px-2 py-1.5 w-32"
        />
        <input
          name="url"
          placeholder="קישור Google Drive…"
          required
          dir="ltr"
          className="flex-1 min-w-[180px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
        />
        <button type="submit" className="text-[12px] font-semibold text-white bg-brand-gradient rounded-md px-3 py-1.5">
          הוספה
        </button>
      </form>
    </div>
  );
}
