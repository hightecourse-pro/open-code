"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Google-Forms-style auto-save for a form (the members' ask, 2/9: "עדיף
 * שהתוכן שכבר מילאתי יישאר"). Drop it INSIDE the form; it watches the
 * closest("form"), snapshots what she typed into localStorage (debounced),
 * and restores it on the next visit — so a hop to another page never costs
 * her the half-filled answers.
 *
 * Coverage is deliberately the SAFE fields: text/textarea/select/checkbox/
 * radio and the rich editors. Hidden inputs of complex widgets (experience
 * lists, multiselect chips) are skipped — restoring their value without
 * their UI state would lie to her.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftShape {
  t: number;
  fields: Record<string, string>;
  checks: Record<string, boolean>;
  rich: Record<string, string>;
}

export function FormDraft({ storageKey, clear = false }: { storageKey: string; clear?: boolean }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    if (clear) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* private mode */
      }
      return;
    }

    const isSafeField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return !!el.name;
      if (!(el instanceof HTMLInputElement) || !el.name) return false;
      return ["text", "email", "tel", "number", "date", "url", "checkbox", "radio"].includes(el.type);
    };

    const richPairs = (): { editable: HTMLElement; input: HTMLInputElement }[] =>
      [...form.querySelectorAll<HTMLElement>('[contenteditable="true"]')]
        .map((editable) => ({
          editable,
          input: editable.parentElement?.querySelector<HTMLInputElement>(':scope > input[type="hidden"][name]') ?? null,
        }))
        .filter((p): p is { editable: HTMLElement; input: HTMLInputElement } => !!p.input);

    // ---------------------------------------------------------- restore once
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as DraftShape;
        if (Date.now() - draft.t < TTL_MS) {
          for (const el of form.elements) {
            if (!isSafeField(el)) continue;
            if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
              const key = `${el.name}::${el.value}`;
              if (key in draft.checks) el.checked = draft.checks[key];
            } else if (el.name in draft.fields && !(el instanceof HTMLInputElement && el.type === "file")) {
              // Only fill where she LEFT something — never blank a
              // server-rendered value with an empty draft entry.
              if (draft.fields[el.name] !== "") el.value = draft.fields[el.name];
            }
          }
          for (const { editable, input } of richPairs()) {
            const html = draft.rich[input.name];
            if (html) {
              editable.innerHTML = html;
              input.value = html;
            }
          }
          setRestoredAt(draft.t);
        }
      }
    } catch {
      /* corrupt/blocked storage — start clean */
    }

    // ------------------------------------------------------------- capture
    let timer: ReturnType<typeof setTimeout> | null = null;
    const snapshot = () => {
      const draft: DraftShape = { t: Date.now(), fields: {}, checks: {}, rich: {} };
      for (const el of form.elements) {
        if (!isSafeField(el)) continue;
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          draft.checks[`${el.name}::${el.value}`] = el.checked;
        } else {
          draft.fields[el.name] = el.value;
        }
      }
      for (const { input } of richPairs()) draft.rich[input.name] = input.value;
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        /* storage full/blocked — autosave just doesn't stick */
      }
    };
    const onInput = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(snapshot, 800);
    };
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      if (timer) clearTimeout(timer);
    };
  }, [storageKey, clear]);

  return (
    <span ref={anchorRef} className="contents">
      {restoredAt !== null && (
        <span className="block text-[11.5px] text-ink-400 -mt-1">
          ✓ שחזרנו את מה שמילאת קודם — הטופס נשמר אוטומטית תוך כדי כתיבה
        </span>
      )}
    </span>
  );
}
