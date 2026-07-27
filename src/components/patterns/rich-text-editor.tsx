"use client";

import { useRef, type ReactNode } from "react";
import { Bold, Heading3, Link2, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

type ToolAction = "bold" | "ul" | "ol" | "h3" | "link";

/**
 * Lightweight rich-text editor for job descriptions. A contentEditable area
 * that mirrors its HTML into a hidden input so it submits like any form field.
 * Deliberately tiny: bold, lists, one heading level and links — the rendered
 * output inherits brand styles (no colors/fonts here by design).
 */
export function RichTextEditor({
  name = "description_html",
  defaultValue,
  id,
}: {
  name?: string;
  defaultValue?: string | null;
  id?: string;
}) {
  // Fully uncontrolled: React never touches the contentEditable's children
  // (any re-render that rewrites them blocks typing). The initial HTML is set
  // once on mount, and every input mirrors straight into the hidden field.
  const areaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef(false);

  function seed(node: HTMLDivElement | null) {
    areaRef.current = node;
    if (node && !seededRef.current) {
      seededRef.current = true;
      if (defaultValue) node.innerHTML = defaultValue;
      if (inputRef.current) inputRef.current.value = node.innerHTML;
    }
  }

  function sync() {
    if (inputRef.current && areaRef.current) {
      inputRef.current.value = areaRef.current.innerHTML;
    }
  }

  function exec(command: string, value?: string) {
    areaRef.current?.focus();
    try {
      // Keep formatting as tags (<b>…), not style spans.
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* not supported — tags are the default anyway */
    }
    document.execCommand(command, false, value);
    sync();
  }

  function toggleHeading() {
    const current = document.queryCommandValue("formatBlock");
    exec("formatBlock", current.toLowerCase() === "h3" ? "<p>" : "<h3>");
  }

  function insertLink() {
    const raw = window.prompt("כתובת הקישור (https://…)");
    if (!raw?.trim()) return;
    const url = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    exec("createLink", url);
  }

  // Data-only tool list; a single dispatcher touches the editor. (Closures
  // over refs inside a render-built array trip the react-hooks/refs lint.)
  const tools: { title: string; icon: ReactNode; action: ToolAction }[] = [
    { title: "מודגש", icon: <Bold size={14} />, action: "bold" },
    { title: "רשימה", icon: <List size={14} />, action: "ul" },
    { title: "רשימה ממוספרת", icon: <ListOrdered size={14} />, action: "ol" },
    { title: "כותרת", icon: <Heading3 size={14} />, action: "h3" },
    { title: "קישור", icon: <Link2 size={14} />, action: "link" },
  ];

  function runTool(action: ToolAction) {
    if (action === "bold") exec("bold");
    else if (action === "ul") exec("insertUnorderedList");
    else if (action === "ol") exec("insertOrderedList");
    else if (action === "h3") toggleHeading();
    else insertLink();
  }

  return (
    <div className="rounded-sm border border-ink-300 bg-ink-0 focus-within:border-brand-purple focus-within:shadow-[0_0_0_3px_rgba(224,65,141,0.15)] transition-[border-color,box-shadow] duration-150">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-ink-200">
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            // preventDefault on mousedown keeps the text selection alive while
            // the toolbar button is clicked.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTool(t.action)}
            className="p-1.5 rounded-[6px] text-ink-500 hover:text-brand-purple hover:bg-tint-purple transition-colors cursor-pointer"
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div
        ref={seed}
        id={id}
        contentEditable
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        className={cn(
          "min-h-28 px-3.5 py-3 font-body text-sm text-ink-900 focus:outline-none",
          // Tailwind preflight strips list/heading styles — restore them so the
          // editor shows what members will see.
          "[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-1",
          "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-2 [&_h3]:mb-1",
          "[&_a]:text-brand-purple [&_a]:underline",
          "[&_p]:my-1"
        )}
      />
      <input type="hidden" name={name} ref={inputRef} />
    </div>
  );
}
