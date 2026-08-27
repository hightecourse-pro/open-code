"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import { createArticle, updateArticle } from "./actions";

export interface EditableArticle {
  id: string;
  title: string;
  excerpt: string | null;
  url: string | null;
  body_html: string | null;
  category: string | null;
  author_name: string | null;
}

/**
 * Create/edit form: an article is EITHER a link out (url) OR in-app rich
 * content (WordPress-style — headings, images, YouTube). The category comes
 * from a dropdown of the categories already in use, and stays free to extend.
 */
export function ArticleEditor({
  article,
  categories,
  onDone,
}: {
  article?: EditableArticle;
  categories: string[];
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<"content" | "link">(article?.url && !article?.body_html ? "link" : "content");
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        if (mode === "link") fd.delete("body_html");
        else fd.delete("url");
        start(async () => {
          if (article) await updateArticle(article.id, fd);
          else await createArticle(fd);
          onDone?.();
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="כותרת" htmlFor="ar-title">
          <Input id="ar-title" name="title" required defaultValue={article?.title ?? ""} />
        </Field>
        <Field label="קטגוריה" htmlFor="ar-cat">
          <Input id="ar-cat" name="category" list="article-categories" defaultValue={article?.category ?? ""} placeholder="בחרי או כתבי חדשה…" />
          <datalist id="article-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="מאת (רשות)" htmlFor="ar-author">
          <Input id="ar-author" name="author_name" defaultValue={article?.author_name ?? ""} />
        </Field>
      </div>

      <Field label="תקציר קצר (מוצג בכרטיס)" htmlFor="ar-excerpt">
        <Textarea id="ar-excerpt" name="excerpt" rows={2} defaultValue={article?.excerpt ?? ""} />
      </Field>

      {/* content vs link */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: "content", label: "תוכן אצלנו" },
            { key: "link", label: "הפניה למאמר חיצוני" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className={
              "rounded-full px-3.5 py-1 text-[12.5px] font-semibold border transition-colors cursor-pointer " +
              (mode === t.key
                ? "bg-brand-gradient text-white border-transparent"
                : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "link" ? (
        <Field label="קישור למאמר" htmlFor="ar-url">
          <Input id="ar-url" name="url" dir="ltr" placeholder="https://…" defaultValue={article?.url ?? ""} />
        </Field>
      ) : (
        <div>
          <RichTextEditor
            name="body_html"
            defaultValue={article?.body_html ?? ""}
            tools={["bold", "italic", "h3", "ul", "ol", "link", "image", "video"]}
            placeholder="כתבי את המאמר כאן — כותרות, רשימות, תמונות וסרטונים…"
          />
          <p className="text-[12px] text-ink-500 mt-1.5">
            תמונה — מדביקים קישור לתמונה; סרטון — מדביקים קישור YouTube והוא מוטמע בתוך המאמר.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {article ? (
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "שומרת…" : "שמירת השינויים"}
          </Button>
        ) : (
          <>
            <Button type="submit" size="sm" name="publish" value="1" disabled={pending}>
              {pending ? "שומרת…" : "פרסום עכשיו"}
            </Button>
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              שמירה כטיוטה
            </Button>
          </>
        )}
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            ביטול
          </Button>
        )}
      </div>
    </form>
  );
}
