import type { Metadata } from "next";
import { BookOpen, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "מאמרים מקצועיים" };

export default async function ArticlesPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, excerpt, url, category, author_name, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מאמרים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מאמרים מקצועיים</h1>
        <p className="t-body-sm text-ink-700">תוכן נבחר שיעזור לך לצמוח מקצועית 💜</p>
      </div>

      {articles && articles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {articles.map((a) => {
            const Wrapper = a.url ? "a" : "div";
            return (
              <Wrapper
                key={a.id}
                {...(a.url ? { href: a.url, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2">
                  {a.category && <Badge variant="purple">{a.category}</Badge>}
                  {a.url && <ExternalLink size={14} className="text-ink-400 ms-auto" />}
                </div>
                <div className="font-display font-bold text-[16px] text-ink-1000 leading-tight">{a.title}</div>
                {a.excerpt && <p className="t-body-sm text-ink-700">{a.excerpt}</p>}
                <div className="text-[11px] text-ink-400 mt-1">
                  {[a.author_name, timeAgo(a.created_at)].filter(Boolean).join(" · ")}
                </div>
              </Wrapper>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-[18px] p-10 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-tint-purple flex items-center justify-center text-brand-purple">
            <BookOpen size={26} />
          </div>
          <p className="t-body text-ink-700 max-w-sm">ספריית המאמרים בדרך — בקרוב יחכה לך כאן תוכן מקצועי נבחר 💜</p>
        </div>
      )}
    </div>
  );
}
