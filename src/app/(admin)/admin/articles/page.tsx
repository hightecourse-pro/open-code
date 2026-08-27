import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArticlesAdminList, type AdminArticle } from "./articles-admin-list";

export const metadata: Metadata = { title: "ניהול מאמרים" };

export default async function AdminArticlesPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, excerpt, url, body_html, category, author_name, is_published, created_at, updated_at")
    .order("created_at", { ascending: false });

  const categories = [
    ...new Set((articles ?? []).map((a) => a.category).filter((c): c is string => !!c)),
  ].sort((a, b) => a.localeCompare(b, "he"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מאמרים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול מאמרים</h1>
        <p className="t-body-sm text-ink-500">
          מאמר יכול להפנות החוצה — או להיכתב כאן, עם עיצוב, תמונות וסרטונים. טיוטה לא מוצגת
          לחברות עד שמפרסמים.
        </p>
      </div>

      <ArticlesAdminList articles={(articles ?? []) as AdminArticle[]} categories={categories} />
    </div>
  );
}
