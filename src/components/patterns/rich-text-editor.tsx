"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Bold, Heading3, Image as ImageIcon, Italic, Link2, List, ListOrdered, Smile, Strikethrough, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type ToolAction = "bold" | "italic" | "strike" | "ul" | "ol" | "h3" | "link" | "image" | "video";

/** The quick palette — the emojis the community actually writes with. */
const EMOJIS = [
  "💜", "🙂", "😄", "🎉", "🙏", "👍", "💪", "🔥",
  "✨", "🤗", "😅", "🤔", "👏", "❤️", "🚀", "☕",
];

/** The thread/composer's imperative handle — restore-on-failure, clear-on-send. */
export interface RichEditorHandle {
  getHtml: () => string;
  setHtml: (html: string) => void;
  clear: () => void;
  focus: () => void;
  isEmpty: () => boolean;
}

/**
 * The one rich-text editor of the product. Born for job descriptions, now also
 * the community's composer (forum, comments, chat) — a contentEditable that
 * shows bold AS bold while typing, mirrored into a hidden input so it submits
 * like any form field. What you see is exactly what gets published; the
 * asterisk markers are history.
 *
 * Deliberately tiny toolbar; the rendered output inherits brand styles.
 */
export function RichTextEditor({
  name = "description_html",
  defaultValue,
  id,
  tools = ["bold", "ul", "ol", "h3", "link"],
  compact = false,
  placeholder,
  submitOnEnter = false,
  editorRef,
  onHtmlChange,
}: {
  name?: string;
  defaultValue?: string | null;
  id?: string;
  /** Which buttons to show, in order. */
  tools?: ToolAction[];
  /** Chat-sized: low minimum height, toolbar under the box. */
  compact?: boolean;
  placeholder?: string;
  /** Enter submits the surrounding form (Shift+Enter = new line) — chat. */
  submitOnEnter?: boolean;
  /** Imperative access for clear-after-send / restore-after-failure. */
  editorRef?: RefObject<RichEditorHandle | null>;
  /** Fires with the current HTML on every edit — for parents that keep the
      value in their own state (e.g. the experience-entry editor). */
  onHtmlChange?: (html: string) => void;
}) {
  // Fully uncontrolled: React never touches the contentEditable's children
  // (any re-render that rewrites them blocks typing). The initial HTML is set
  // once on mount, and every input mirrors straight into the hidden field.
  const areaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

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
    if (onHtmlChange && areaRef.current) onHtmlChange(areaRef.current.innerHTML);
  }

  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      getHtml: () => areaRef.current?.innerHTML ?? "",
      setHtml: (html: string) => {
        if (areaRef.current) areaRef.current.innerHTML = html;
        sync();
      },
      clear: () => {
        if (areaRef.current) areaRef.current.innerHTML = "";
        sync();
      },
      focus: () => areaRef.current?.focus(),
      isEmpty: () => !(areaRef.current?.textContent ?? "").trim(),
    };
    return () => {
      editorRef.current = null;
    };
  }, [editorRef]);

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
  const ALL_TOOLS: Record<ToolAction, { title: string; icon: ReactNode }> = {
    bold: { title: "מודגש", icon: <Bold size={14} /> },
    italic: { title: "נטוי", icon: <Italic size={14} /> },
    strike: { title: "קו חוצה", icon: <Strikethrough size={14} /> },
    ul: { title: "רשימה", icon: <List size={14} /> },
    ol: { title: "רשימה ממוספרת", icon: <ListOrdered size={14} /> },
    h3: { title: "כותרת", icon: <Heading3 size={14} /> },
    link: { title: "קישור", icon: <Link2 size={14} /> },
    image: { title: "תמונה (קישור)", icon: <ImageIcon size={14} /> },
    video: { title: "סרטון YouTube", icon: <Video size={14} /> },
  };

  function insertImage() {
    // A local file, like she expects: read as a data URI so it previews
    // instantly; the article save hosts it in storage and swaps the URL.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        window.alert("התמונה גדולה מדי — עד 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") exec("insertImage", reader.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function insertVideo() {
    const raw = window.prompt("קישור לסרטון YouTube");
    const url = raw?.trim();
    if (!url) return;
    // Accept youtu.be/<id>, youtube.com/watch?v=<id> or a ready /embed/ URL.
    const id =
      /youtu\.be\/([\w-]{6,})/.exec(url)?.[1] ??
      /[?&]v=([\w-]{6,})/.exec(url)?.[1] ??
      /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/.exec(url)?.[1];
    if (!id) {
      window.alert("לא זיהיתי קישור YouTube — נסי להעתיק את הקישור המלא של הסרטון.");
      return;
    }
    exec(
      "insertHTML",
      `<iframe src="https://www.youtube-nocookie.com/embed/${id}"></iframe><p><br/></p>`
    );
  }

  function runTool(action: ToolAction) {
    if (action === "bold") exec("bold");
    else if (action === "italic") exec("italic");
    else if (action === "strike") exec("strikeThrough");
    else if (action === "ul") exec("insertUnorderedList");
    else if (action === "ol") exec("insertOrderedList");
    else if (action === "h3") toggleHeading();
    else if (action === "image") insertImage();
    else if (action === "video") insertVideo();
    else insertLink();
  }

  const toolbar = (
    <div
      className={cn(
        "relative flex items-center gap-0.5 px-1.5 py-1",
        compact ? "border-t border-ink-100" : "border-b border-ink-200"
      )}
    >
      {tools.map((t) => (
        <button
          key={t}
          type="button"
          title={ALL_TOOLS[t].title}
          aria-label={ALL_TOOLS[t].title}
          // preventDefault on mousedown keeps the text selection alive while
          // the toolbar button is clicked.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runTool(t)}
          className="p-1.5 rounded-[6px] text-ink-500 hover:text-brand-purple hover:bg-tint-purple transition-colors cursor-pointer"
        >
          {ALL_TOOLS[t].icon}
        </button>
      ))}
      {/* Emoji palette (PM ask) — inserted at the caret like typed text. */}
      <button
        type="button"
        title="אימוג'י"
        aria-label="אימוג'י"
        aria-expanded={emojiOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setEmojiOpen((v) => !v)}
        className="p-1.5 rounded-[6px] text-ink-500 hover:text-brand-purple hover:bg-tint-purple transition-colors cursor-pointer"
      >
        <Smile size={14} />
      </button>
      {emojiOpen && (
        <div
          className={cn(
            "absolute start-1 z-20 bg-white border border-ink-200 rounded-md shadow-md p-1.5 grid grid-cols-8 gap-0.5",
            compact ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                exec("insertText", e);
                setEmojiOpen(false);
              }}
              className="w-7 h-7 rounded hover:bg-tint-purple text-[16px] leading-none cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const area = (
    <div
      ref={seed}
      id={id}
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      suppressContentEditableWarning
      onInput={sync}
      onBlur={sync}
      onKeyDown={
        submitOnEnter
          ? (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sync();
                e.currentTarget.closest("form")?.requestSubmit();
              }
            }
          : undefined
      }
      className={cn(
        "px-3.5 font-body text-sm text-ink-900 focus:outline-none",
        compact ? "min-h-10 max-h-32 overflow-y-auto py-2.5" : "min-h-28 py-3",
        // The placeholder: shown only while truly empty.
        "empty:before:content-[attr(data-placeholder)] empty:before:text-ink-400 empty:before:pointer-events-none",
        // Tailwind preflight strips list/heading styles — restore them so the
        // editor shows what members will see.
        "[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-1",
        "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-2 [&_h3]:mb-1",
        "[&_a]:text-brand-purple [&_a]:underline",
        "[&_p]:my-1"
      )}
    />
  );

  return (
    <div
      className={cn(
        "rounded-sm border border-ink-300 bg-ink-0 focus-within:border-brand-purple focus-within:shadow-[0_0_0_3px_rgba(224,65,141,0.15)] transition-[border-color,box-shadow] duration-150",
        compact && "rounded-md flex-1"
      )}
    >
      {compact ? area : toolbar}
      {compact ? toolbar : area}
      <input type="hidden" name={name} ref={inputRef} />
    </div>
  );
}
