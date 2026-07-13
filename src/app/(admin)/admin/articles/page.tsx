import type { Metadata } from "next";
import { Trash2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createArticle, deleteArticle } from "./actions";

export const metadata: Metadata = { title: "ניהול מאמרים" };

export default async function AdminArticlesPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, excerpt, url, category, author_name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מאמרים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול מאמרים</h1>
        <p className="t-body-sm text-ink-500">מאמרים מקצועיים שהחברות רואות בעמוד המאמרים.</p>
      </div>

      <form action={createArticle} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        <h3 className="font-display text-base font-bold">הוספת מאמר</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="title" placeholder="כותרת" required className="text-sm border border-ink-300 rounded-md px-3 py-2" />
          <input name="category" placeholder="קטגוריה" className="text-sm border border-ink-300 rounded-md px-3 py-2" />
          <input name="author_name" placeholder="מאת (אופציונלי)" className="text-sm border border-ink-300 rounded-md px-3 py-2" />
          <input name="url" placeholder="קישור למאמר (אופציונלי)" dir="ltr" className="text-sm border border-ink-300 rounded-md px-3 py-2" />
        </div>
        <textarea name="excerpt" placeholder="תקציר קצר" rows={2} className="text-sm border border-ink-300 rounded-md px-3 py-2" />
        <button type="submit" className="self-start text-sm font-semibold text-white bg-brand-gradient rounded-md px-4 py-2">
          הוספת מאמר
        </button>
      </form>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">כל המאמרים ({articles?.length ?? 0})</h3>
        <div className="flex flex-col">
          {(articles ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate flex items-center gap-1.5">
                  {a.title}
                  {a.url && <ExternalLink size={13} className="text-ink-400 shrink-0" />}
                </div>
                <div className="text-xs text-ink-500 truncate">
                  {[a.category, a.author_name].filter(Boolean).join(" · ") || a.excerpt}
                </div>
              </div>
              <form action={deleteArticle.bind(null, a.id)}>
                <button type="submit" className="text-ink-400 hover:text-danger p-1.5" title="מחיקה">
                  <Trash2 size={15} />
                </button>
              </form>
            </div>
          ))}
          {(articles ?? []).length === 0 && <p className="text-ink-500 text-sm py-4">אין מאמרים עדיין.</p>}
        </div>
      </div>
    </div>
  );
}
