"use client";

import { useState } from "react";
import { ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { deleteArticle, setArticlePublished } from "./actions";
import { ArticleEditor, type EditableArticle } from "./article-editor";

export interface AdminArticle extends EditableArticle {
  is_published: boolean;
  created_at: string;
  updated_at: string | null;
}

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

export function ArticlesAdminList({
  articles,
  categories,
}: {
  articles: AdminArticle[];
  categories: string[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const drafts = articles.filter((a) => !a.is_published);
  const published = articles.filter((a) => a.is_published);

  const Row = ({ a }: { a: AdminArticle }) => (
    <div className="py-2.5 border-b border-ink-100 last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="font-medium text-ink-900 flex items-center gap-1.5">
            {a.title}
            {a.url ? (
              <ExternalLink size={13} className="text-ink-400 shrink-0" />
            ) : (
              <FileText size={13} className="text-ink-400 shrink-0" />
            )}
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            {[a.category, a.author_name].filter(Boolean).join(" · ")}
            <span className="tabular-nums"> · נוצר {DATE_HE.format(new Date(a.created_at))}</span>
            {a.updated_at && (
              <span className="tabular-nums"> · נערך {DATE_HE.format(new Date(a.updated_at))}</span>
            )}
          </div>
        </div>
        <Badge variant={a.is_published ? "mint" : "tech"}>{a.is_published ? "מפורסם" : "טיוטה"}</Badge>
        <Button size="sm" variant="secondary" onClick={() => void setArticlePublished(a.id, !a.is_published)}>
          {a.is_published ? "החזרה לטיוטה" : "פרסום"}
        </Button>
        <button
          type="button"
          onClick={() => setEditingId((v) => (v === a.id ? null : a.id))}
          className="text-ink-400 hover:text-brand-purple p-1.5"
          title="עריכה"
        >
          <Pencil size={15} />
        </button>
        <ConfirmActionButton
          action={deleteArticle.bind(null, a.id)}
          message={`למחוק את המאמר "${a.title}" לצמיתות? הפעולה אינה ניתנת לביטול.`}
          title="מחיקה"
          className="text-ink-400 hover:text-danger p-1.5"
        >
          <Trash2 size={15} />
        </ConfirmActionButton>
      </div>
      {editingId === a.id && (
        <div className="bg-ink-50 border border-ink-200 rounded-md p-3 mt-2">
          <ArticleEditor article={a} categories={categories} onDone={() => setEditingId(null)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-display text-base font-bold">הוספת מאמר</h3>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              מאמר חדש
            </Button>
          )}
        </div>
        {creating && <ArticleEditor categories={categories} onDone={() => setCreating(false)} />}
      </div>

      {drafts.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-2">טיוטות ({drafts.length})</h3>
          <div className="flex flex-col">
            {drafts.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-2">מפורסמים ({published.length})</h3>
        <div className="flex flex-col">
          {published.map((a) => (
            <Row key={a.id} a={a} />
          ))}
          {published.length === 0 && <p className="text-ink-500 text-sm py-3">אין מאמרים מפורסמים.</p>}
        </div>
      </div>
    </div>
  );
}
