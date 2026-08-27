"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { sanitizeArticleHtml } from "@/lib/rich-text";

function articleFields(formData: FormData) {
  const rawBody = String(formData.get("body_html") ?? "");
  const body = sanitizeArticleHtml(rawBody);
  return {
    excerpt: String(formData.get("excerpt") ?? "").trim() || null,
    url: String(formData.get("url") ?? "").trim() || null,
    body_html: body || null,
    category: String(formData.get("category") ?? "").trim() || null,
    author_name: String(formData.get("author_name") ?? "").trim() || null,
  };
}

/** Create an article — as a draft or published, the admin's choice. */
export async function createArticle(formData: FormData): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("articles").insert({
    title,
    ...articleFields(formData),
    is_published: formData.get("publish") === "1",
  });
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
}

/** Full edit of an existing article. */
export async function updateArticle(id: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase
    .from("articles")
    .update({ title, ...articleFields(formData), updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
  revalidatePath(`/articles/${id}`);
}

/** Draft ↔ published. */
export async function setArticlePublished(id: string, published: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("articles").update({ is_published: published }).eq("id", id);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
}

export async function deleteArticle(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("articles").delete().eq("id", id);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
}
