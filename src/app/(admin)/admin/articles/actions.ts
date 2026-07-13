"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function createArticle(formData: FormData): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("articles").insert({
    title,
    excerpt: String(formData.get("excerpt") ?? "").trim() || null,
    url: String(formData.get("url") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    author_name: String(formData.get("author_name") ?? "").trim() || null,
  });
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
