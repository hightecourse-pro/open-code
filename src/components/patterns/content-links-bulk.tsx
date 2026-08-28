"use client";

import { useState, useTransition } from "react";
import { FolderOpen, Trash2, Video } from "lucide-react";
import { bulkDeleteContentLinks, deleteContentLink } from "@/app/(admin)/admin/content/actions";
import type { ContentLink } from "@/types/database";

/**
 * The links list with checkbox selection — pick several inside one course or
 * session and act on them together (Shira: bulk actions inside each).
 */
export function ContentLinksBulkList({ links }: { links: ContentLink[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const picked = links.filter((l) => selected[l.id]);

  return (
    <div className="flex flex-col gap-1">
      {picked.length > 0 && (
        <div className="flex items-center gap-2.5 bg-tint-purple/50 border border-[#DDC9EC] rounded-md px-3 py-1.5">
          <span className="text-[12px] font-semibold text-brand-purple">
            נבחרו {picked.length}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`למחוק ${picked.length} קישורים? אי אפשר לשחזר.`)) return;
              start(() => bulkDeleteContentLinks(picked.map((l) => l.id)));
            }}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger cursor-pointer"
          >
            <Trash2 size={12} /> {pending ? "מוחקת…" : "מחיקת הנבחרים"}
          </button>
          <button
            type="button"
            onClick={() => setSelected({})}
            className="text-[11.5px] text-ink-500 hover:text-ink-900 underline cursor-pointer"
          >
            ניקוי
          </button>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-ink-100">
        {links.map((l) => (
          <li key={l.id} className="flex items-center gap-2 py-1.5">
            <input
              type="checkbox"
              checked={!!selected[l.id]}
              onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))}
              aria-label="בחירה"
              className="accent-[#8B5CF6] cursor-pointer shrink-0"
            />
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
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`למחוק את "${l.title}"?`)) return;
                start(() => deleteContentLink(l.id));
              }}
              className="ms-auto shrink-0 text-ink-400 hover:text-danger cursor-pointer"
              title="מחיקה"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
