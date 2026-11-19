"use client";

import { useEffect, useRef, useState } from "react";
import { deleteFormDraft, loadFormDraft, saveFormDraft } from "./form-draft-actions";

/**
 * Google-Forms-style auto-save for a form (the members' ask, 2/9: "עדיף
 * שהתוכן שכבר מילאתי יישאר"). Drop it INSIDE the form; it watches the
 * closest("form"), snapshots what she typed into localStorage (debounced),
 * and restores it on the next visit - so a hop to another page never costs
 * her the half-filled answers.
 *
 * Coverage is deliberately the SAFE fields: text/textarea/select/checkbox/
 * radio and the rich editors. Hidden inputs of complex widgets (experience
 * lists, multiselect chips) are skipped - restoring their value without
 * their UI state would lie to her.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftShape {
  t: number;
  fields: Record<string, string>;
  checks: Record<string, boolean>;
  rich: Record<string, string>;
}

export function FormDraft({
  storageKey,
  clear = false,
  staleAfter,
  remote = false,
}: {
  storageKey: string;
  clear?: boolean;
  /**
   * Also keep the draft on the server, under her account (Shoshana Ben-Haim,
   * 14.11: the draft stayed on one computer). The newer copy wins on open.
   */
  remote?: boolean;
  /**
   * The record's last successful save time (ISO). A draft OLDER than it
   * predates a save that already happened - restoring it would resurrect
   * old text over the truth (the member's "לא שומר שינויים", 14/9). Such a
   * draft is dropped instead of restored.
   */
  staleAfter?: string | null;
}) {
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
      if (remote) deleteFormDraft(storageKey).catch(() => undefined);
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
    const staleMs = staleAfter ? Date.parse(staleAfter) : 0;
    let localT = 0;
    let touched = false;
    const applyDraft = (draft: DraftShape) => {
          for (const el of form.elements) {
            if (!isSafeField(el)) continue;
            if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
              const key = `${el.name}::${el.value}`;
              if (key in draft.checks) el.checked = draft.checks[key];
            } else if (el.name in draft.fields && !(el instanceof HTMLInputElement && el.type === "file")) {
              // Only fill where she LEFT something - never blank a
              // server-rendered value with an empty draft entry.
              if (draft.fields[el.name] !== "") el.value = draft.fields[el.name];
            }
          }
          for (const { editable, input } of richPairs()) {
            const html = draft.rich[input.name];
            // Chrome leaves "<div><br></div>" behind in an emptied editor -
            // restoring that over saved text blanked answers (19/9).
            const hasText = !!html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim() !== "";
            if (hasText) {
              editable.innerHTML = html;
              input.value = html;
            }
          }
          const at = draft.t;
          setTimeout(() => setRestoredAt(at), 0);
    };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as DraftShape;
        if (staleMs && draft.t < staleMs) {
          // The form was saved AFTER this draft was written - the server is
          // the newer truth; the leftover draft must not overwrite it.
          localStorage.removeItem(storageKey);
        } else if (Date.now() - draft.t < TTL_MS) {
          applyDraft(draft);
          localT = draft.t;
        }
      }
    } catch {
      /* corrupt/blocked storage - start clean */
    }
    // the server copy (another device): applied only when newer than this browser's, and only
    // while she has not started typing here - a late answer must never overwrite live input
    let cancelled = false;
    if (remote) {
      loadFormDraft(storageKey)
        .then((r) => {
          if (cancelled || !r || touched) return;
          const draft = r.data as unknown as DraftShape;
          if (!draft || typeof draft.t !== "number" || !draft.fields) return;
          if (draft.t <= localT || (staleMs && draft.t < staleMs) || Date.now() - draft.t >= TTL_MS) return;
          applyDraft(draft);
          try {
            localStorage.setItem(storageKey, JSON.stringify(draft));
          } catch {
            /* fine */
          }
        })
        .catch(() => undefined);
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
        /* storage full/blocked - autosave just doesn't stick */
      }
      if (remote) {
        if (remoteTimer) clearTimeout(remoteTimer);
        remoteTimer = setTimeout(() => {
          saveFormDraft(storageKey, draft as unknown as Record<string, unknown>).catch(() => undefined);
        }, 2500);
      }
    };
    let remoteTimer: ReturnType<typeof setTimeout> | null = null;
    const onInput = () => {
      touched = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(snapshot, 800);
    };
    // React 19 resets an uncontrolled form after EVERY server action - a
    // failed one too. A member filled the whole application, the server said
    // "no CV attached", and the page wiped her answers (מרגלית חזני, 15/10).
    // The programmatic reset (not a trusted "reset" button click) is refused
    // while she has content on the form; a successful submit redirects or
    // clears the draft on its own.
    // (form.reset() fires a TRUSTED event, so the button click is what tells
    // a deliberate reset apart from React's automatic one.)
    let resetButtonClicked = false;
    const onClick = (e: Event) => {
      const el = e.target instanceof Element ? e.target.closest("button, input") : null;
      resetButtonClicked = !!el && (el as HTMLButtonElement | HTMLInputElement).type === "reset";
    };
    const readFields = () => {
      const fields: { el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; value: string; checked: boolean }[] = [];
      for (const el of form.elements) {
        if (!isSafeField(el)) continue;
        fields.push({ el, value: el.value, checked: el instanceof HTMLInputElement ? el.checked : false });
      }
      return fields;
    };
    const onReset = (e: Event) => {
      if (resetButtonClicked) {
        resetButtonClicked = false;
        return;
      }
      const before = readFields();
      const hasContent = before.some((f) => !(f.el instanceof HTMLInputElement && (f.el.type === "checkbox" || f.el.type === "radio")) && f.value.trim() !== "");
      if (!hasContent) return;
      e.preventDefault();
      // belt and braces: if the reset went through anyway, put her text back
      setTimeout(() => {
        for (const f of before) {
          if (f.el instanceof HTMLInputElement && (f.el.type === "checkbox" || f.el.type === "radio")) {
            if (f.el.checked !== f.checked) f.el.checked = f.checked;
          } else if (f.el.value !== f.value && !(f.el instanceof HTMLInputElement && f.el.type === "file")) {
            f.el.value = f.value;
          }
        }
      }, 0);
    };
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("click", onClick, true);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      form.removeEventListener("click", onClick, true);
      form.removeEventListener("reset", onReset);
      if (timer) clearTimeout(timer);
      if (remoteTimer) clearTimeout(remoteTimer);
      cancelled = true;
    };
  }, [storageKey, clear, staleAfter, remote]);

  return (
    <span ref={anchorRef} className="contents">
      {restoredAt !== null && (
        <span className="block text-[11.5px] text-ink-400 -mt-1">
          ✓ שחזרנו את מה שמילאת קודם - הטופס נשמר אוטומטית תוך כדי כתיבה{remote ? ", גם אם תמשיכי ממחשב אחר" : ""}
        </span>
      )}
    </span>
  );
}
