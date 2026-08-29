"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { sanitizeArticleHtml } from "@/lib/rich-text";

const DATA_IMG = /<img\b[^>]*src\s*=\s*["'](data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+))["'][^>]*\/?>/gi;
const MAX_INLINE_IMG_BYTES = 5 * 1024 * 1024;

/**
 * A PASTED image lands in the editor as a data: URI, which the sanitizer
 * (rightly, https-only) used to strip — "התמונה נעלמת בשמירה". Host every
 * inline image in the public article-images bucket and swap in its URL
 * BEFORE sanitizing, so the save keeps exactly what the editor showed.
 */
async function hostInlineImages(html: string): Promise<string> {
  if (!html.includes("data:image/")) return html;
  const admin = createAdminClient();
  const jobs: { placeholder: string; url: string }[] = [];
  let i = 0;
  let out = html;
  for (const m of html.matchAll(DATA_IMG)) {
    const [full, , kind, b64] = m;
    try {
      const bytes = Buffer.from(b64, "base64");
      if (bytes.length === 0 || bytes.length > MAX_INLINE_IMG_BYTES) continue;
      const ext = kind === "jpeg" ? "jpg" : kind;
      const path = `articles/${Date.now()}-${i++}.${ext}`;
      const { error } = await admin.storage
        .from("article-images")
        .upload(path, bytes, { contentType: `image/${kind}`, upsert: false });
      if (error) continue; // the sanitizer will drop it — same as before, not worse
      const { data } = admin.storage.from("article-images").getPublicUrl(path);
      if (data?.publicUrl) jobs.push({ placeholder: full, url: data.publicUrl });
    } catch (e) {
      console.error("[articles] inline image host failed:", e);
    }
  }
  for (const j of jobs) {
    out = out.replace(j.placeholder, `<img src="${j.url}" loading="lazy" alt="" />`);
  }
  return out;
}

async function articleFields(formData: FormData) {
  const rawBody = String(formData.get("body_html") ?? "");
  const body = sanitizeArticleHtml(await hostInlineImages(rawBody));
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
    ...(await articleFields(formData)),
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
    .update({ title, ...(await articleFields(formData)), updated_at: new Date().toISOString() })
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
