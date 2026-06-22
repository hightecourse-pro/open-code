"use client";

import { useActionState, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createPost, type ComposerState } from "@/app/(app)/feed/actions";
import type { PostIntent } from "@/types/database";

const INTENTS: { value: PostIntent; label: string }[] = [
  { value: "consult", label: "התייעצות" },
  { value: "knowledge", label: "שיתוף ידע" },
  { value: "success", label: "הצלחה 🎉" },
];

export function Composer({ kind = "feed" }: { kind?: "feed" | "forum" }) {
  const [intent, setIntent] = useState<PostIntent>("knowledge");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ComposerState, FormData>(
    async (prev, formData) => {
      const result = await createPost(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    {}
  );

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-4 px-[18px] shadow-sm">
      <div className="font-display font-bold text-[15px] text-ink-1000 mb-2.5 flex items-center gap-1.5">
        <MessageSquare size={17} className="text-brand-pink-deep" />
        פתחי פוסט להתייעצות או שיתוף ידע
      </div>

      {state.error && (
        <Alert variant="danger" className="mb-3">
          {state.error}
        </Alert>
      )}

      <form ref={formRef} action={action}>
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="kind" value={kind} />
        <textarea
          name="body"
          rows={2}
          placeholder="מה את רוצה לשתף עם הקהילה?"
          className="w-full border-none outline-none resize-none text-[15px] text-ink-900 py-1.5 placeholder:text-ink-400"
        />

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

        <div className="flex items-center mt-3 pt-3 border-t border-ink-100">
          <Button type="submit" size="sm" disabled={pending} className="ms-auto">
            {pending ? "שולח…" : "שיתוף"}
          </Button>
        </div>
      </form>
    </div>
  );
}
