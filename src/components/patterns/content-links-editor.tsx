import { addContentLink } from "@/app/(admin)/admin/content/actions";
import { ContentLinksBulkList } from "@/components/patterns/content-links-bulk";
import type { ContentLink, ContentOwner } from "@/types/database";

/**
 * Admin editor for a course/session's Drive links. Each link is tagged as a
 * view-only video or a materials folder. Pure server component — every control
 * is a server-action form.
 */
export function ContentLinksEditor({
  ownerType,
  ownerId,
  unitId = null,
  links,
}: {
  ownerType: ContentOwner;
  ownerId: string;
  /** The course unit these links belong to, when the course has units. */
  unitId?: string | null;
  links: ContentLink[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 ? (
        <ContentLinksBulkList links={links} />
      ) : (
        <p className="text-[12px] text-ink-400">אין עדיין קישורים.</p>
      )}

      <form
        action={addContentLink.bind(null, ownerType, ownerId, unitId)}
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
