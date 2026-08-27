// An in-app article: admin-authored rich content (sanitized on save AND at
// render — same defense-in-depth as the community bodies).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireCommunityAccess } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { sanitizeArticleHtml } from "@/lib/rich-text";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

async function loadArticle(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("id, title, excerpt, body_html, category, author_name, created_at")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const a = await loadArticle(id);
  return { title: a?.title ?? "מאמר" };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireCommunityAccess();
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article || !article.body_html) notFound();

  return (
    <div className="flex flex-col gap-4 max-w-[760px]">
      <Link
        href="/articles"
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה לכל המאמרים
      </Link>

      <article className="bg-white border border-ink-200 rounded-[18px] p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          {article.category && <Badge variant="purple">{article.category}</Badge>}
        </div>
        <h1 className="font-display text-[28px] font-black text-ink-1000 leading-tight">
          {article.title}
        </h1>
        <div className="text-[12.5px] text-ink-500 mt-1.5 mb-5">
          {[article.author_name, DATE_HE.format(new Date(article.created_at))]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div
          dir="rtl"
          className={[
            "text-[15px] text-ink-900 leading-relaxed",
            "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-[19px] [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-ink-1000",
            "[&_p]:my-2 [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-2",
            "[&_a]:text-brand-purple [&_a]:underline [&_b]:text-ink-1000 [&_strong]:text-ink-1000",
            "[&_img]:rounded-xl [&_img]:my-3 [&_img]:max-w-full",
            "[&_.rt-video]:block [&_.rt-video]:my-3 [&_.rt-video_iframe]:w-full [&_.rt-video_iframe]:aspect-video [&_.rt-video_iframe]:rounded-xl [&_.rt-video_iframe]:border-0",
          ].join(" ")}
          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body_html) }}
        />
      </article>
    </div>
  );
}
