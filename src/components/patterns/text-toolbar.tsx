"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Bold, Italic, Code, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The little bar under a message box: bold / italic / code and an emoji
 * picker. It writes the same markers people already use in WhatsApp, wrapping
 * whatever is selected — so the habit transfers and nothing new is learned.
 */

const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "רגשות",
    items: ["😊", "😁", "🥰", "😍", "🤩", "😂", "🙃", "😉", "🤗", "🤔", "😅", "😌", "🥳", "😎", "🙈", "😴", "😢", "😮"],
  },
  {
    label: "מחוות",
    items: ["👍", "👏", "🙏", "💪", "🤝", "👌", "✌️", "🫶", "🙌", "✍️", "👀", "🤞"],
  },
  {
    label: "לב וחגיגה",
    items: ["💜", "💗", "❤️", "🧡", "💛", "💚", "💙", "🎉", "🎊", "🥂", "✨", "🌸", "🌟", "🔥", "💫"],
  },
  {
    label: "עבודה וקוד",
    items: ["💻", "⌨️", "🖥️", "📱", "🐛", "🚀", "⚡", "🧩", "📚", "📝", "📌", "✅", "❌", "⏰", "☕", "🎯", "💡", "🛠️"],
  },
];

export function TextToolbar({
  targetRef,
  className,
}: {
  /** The textarea these buttons write into. */
  targetRef: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Click outside / Esc closes the picker — the usual expectations.
  useEffect(() => {
    if (!emojiOpen) return;
    function onDown(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node)) setEmojiOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  /** Put text into the box at the caret and keep the caret sensible. */
  function insert(before: string, after = "", placeholder = "") {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const raw = el.value.slice(start, end);

    // Mouse drags and double-click word selection routinely include the edge
    // spaces, and the parser (correctly, WhatsApp-style) rejects markers whose
    // content starts or ends with whitespace — so "*ראית *" published as raw
    // markers and read as "the buttons don't work". Keep edge whitespace
    // OUTSIDE the markers.
    let lead = raw.match(/^\s*/)?.[0] ?? "";
    let trail = raw.slice(lead.length).match(/\s*$/)?.[0] ?? "";
    const rawCore = raw.slice(lead.length, raw.length - trail.length);
    if (!rawCore) {
      lead = raw;
      trail = "";
    }
    const usedPlaceholder = !rawCore && after !== "";
    const core = rawCore || placeholder;
    const next =
      el.value.slice(0, start) + lead + before + core + after + trail + el.value.slice(end);

    // Set through the native setter so React's onChange sees the new value.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    const coreStart = start + lead.length + before.length;
    el.focus();
    if (usedPlaceholder) {
      // Select the placeholder so typing replaces it — the parked-caret version
      // produced "*טקסטמהשהיאהקלידה*" with the literal word published.
      el.setSelectionRange(coreStart, coreStart + core.length);
    } else {
      const caret = coreStart + core.length + after.length + trail.length;
      el.setSelectionRange(caret, caret);
    }
  }

  const btn =
    "w-7 h-7 rounded-md flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-brand-purple transition-colors";

  return (
    <div className={cn("flex items-center gap-0.5 relative", className)}>
      <button type="button" className={btn} title="מודגש" aria-label="מודגש" onClick={() => insert("*", "*", "טקסט")}>
        <Bold size={15} />
      </button>
      <button type="button" className={btn} title="נטוי" aria-label="נטוי" onClick={() => insert("_", "_", "טקסט")}>
        <Italic size={15} />
      </button>
      <button type="button" className={btn} title="קוד" aria-label="קוד" onClick={() => insert("`", "`", "code")}>
        <Code size={15} />
      </button>
      <button
        type="button"
        className={cn(btn, emojiOpen && "bg-ink-100 text-brand-purple")}
        title="אימוג'י"
        aria-label="אימוג'י"
        aria-expanded={emojiOpen}
        onClick={() => setEmojiOpen((o) => !o)}
      >
        <Smile size={15} />
      </button>

      {emojiOpen && (
        <div
          ref={popRef}
          className="absolute z-30 top-8 start-0 w-[268px] max-h-[236px] overflow-y-auto bg-white border border-ink-200 rounded-xl shadow-lg p-2.5 flex flex-col gap-2"
        >
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="text-[10.5px] text-ink-400 mb-1">{g.label}</div>
              <div className="flex flex-wrap gap-0.5">
                {g.items.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="w-7 h-7 text-[17px] leading-none rounded-md hover:bg-ink-100"
                    onClick={() => {
                      insert(e);
                      setEmojiOpen(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <span className="text-[11px] text-ink-400 ms-1 hidden sm:inline">
        *מודגש* _נטוי_ `קוד`
      </span>
    </div>
  );
}
