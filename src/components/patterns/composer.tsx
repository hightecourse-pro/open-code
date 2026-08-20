"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { RichTextEditor, type RichEditorHandle } from "@/components/patterns/rich-text-editor";
import { createPost, type ComposerState } from "@/app/(app)/feed/actions";
import type { PostIntent } from "@/types/database";

const INTENTS: { value: PostIntent; label: string }[] = [
  { value: "consult", label: "התייעצות" },
  { value: "knowledge", label: "שיתוף ידע" },
  { value: "success", label: "הצלחה 🎉" },
];

export function Composer({ kind = "feed" }: { kind?: "feed" | "forum" }) {
  const [intent, setIntent] = useState<PostIntent>("knowledge");
  const [published, setPublished] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<RichEditorHandle | null>(null);
  const [state, action, pending] = useActionState<ComposerState, FormData>(
    async (prev, formData) => {
      const result = await createPost(prev, formData);
      if (!result.error) {
        formRef.current?.reset();
        bodyRef.current?.clear();
        setPublished(true);
        // createPost already revalidates this route; this is the belt to its
        // braces — a form cleared with nothing new on screen reads as "my post
        // disappeared", and one extra fetch is cheaper than that doubt.
        router.refresh();
      }
      return result;
    },
    {}
  );

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-4 px-[18px] shadow-sm">
      <div className="font-display font-bold text-[15px] text-ink-1000 mb-2.5 flex items-center gap-1.5">
        <MessageSquare size={17} className="text-brand-pink-deep" />
        פתחי פוסט להתייעצות או לשיתוף ידע
      </div>

      {state.error && (
        <Alert variant="danger" className="mb-3">
          {state.error}
        </Alert>
      )}

      <form ref={formRef} action={action}>
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="kind" value={kind} />
        <div onInput={() => published && setPublished(false)}>
          <RichTextEditor
            name="body"
            editorRef={bodyRef}
            placeholder="מה את רוצה לשתף עם הקהילה?"
            tools={["bold", "italic", "strike", "ul", "ol", "link"]}
          />
        </div>

        <div className="flex gap-2 mt-2.5 flex-wrap">
          {INTENTS.map((it) => (
            <button
              key={it.value}
              type="button"
              onClick={() => setIntent(it.value)}
              className={cn(
                "font-display font-semibold text-[13px] px-3.5 py-[7px] rounded-full border-[1.5px] transition-all",
                intent === it.value
                  ? "bg-brand-gradient text-white border-transparent"
                  : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
              )}
            >
              {it.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-ink-100">
          {published && !pending && (
            <span className="text-[12.5px] font-semibold text-brand-purple">
              {kind === "forum" ? "פורסם! הנושא שלך בראש הרשימה 💜" : "פורסם! הפוסט שלך בראש הפיד 💜"}
            </span>
          )}
          <Button type="submit" size="sm" disabled={pending} className="ms-auto">
            {pending ? "שולח…" : "שיתוף"}
          </Button>
        </div>
      </form>
    </div>
  );
}
