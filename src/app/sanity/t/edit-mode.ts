// ============================================================================
// The game's edit mode (the owner, 26.11, the night before the conference: ״כרטיס שנראה בדיוק כמו במשחק רק שאני
// לוחץ על טקסט אני משנה … וניהול למעלה״). Opened as /sanity/t/<token>?edit=1 behind the studio's door. Every Hebrew
// text of the content object is marked with its path (markDeep); after each render the marks become editable spans
// (decorate); a change is kept on the server (/api/sanity/texts) until Claude moves it into the code, and the bar on
// top walks every screen and shows which ones were seen and which were changed.
// ============================================================================
import type { Phase } from "@/lib/sanity/engine";
import type { ZoneId } from "@/lib/sanity/content";

const M0 = "", M1 = "", M2 = "";
const SKIP = new Set(["id", "color", "deep", "gender"]);
const MARK_RE = /([^]+)([\s\S]*?)/g;

/** The content object with every Hebrew string wrapped in markers; an edit in `edits` replaces the original. */
export function markDeep<T>(obj: T, edits: Map<string, string>, path: string[] = []): T {
  if (typeof obj === "string") {
    const key = path.join(".");
    const last = path[path.length - 1] ?? "";
    if (SKIP.has(last) || !/[^\x00-\x7f]/.test(obj)) return obj;
    return (M0 + key + M1 + (edits.get(key) ?? obj) + M2) as unknown as T;
  }
  if (Array.isArray(obj) || (obj && typeof obj === "object")) {
    return new Proxy(obj as object, {
      get: (t, p) => {
        const v = Reflect.get(t, p);
        return typeof p === "string" && (typeof v === "string" || (v && typeof v === "object")) && !(typeof v === "function") ? markDeep(v, edits, [...path, p]) : v;
      },
    }) as T;
  }
  return obj;
}

const STRIP = (s: string) => s.replace(/[^]*/g, "").replace(//g, "");

/** Turn the marks into editable spans (or make the holding element editable when a text spans tags), strip the rest. */
export function decorate(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const texts: Text[] = [];
  const els: Element[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (/[]/.test((n as Text).data)) texts.push(n as Text);
    } else els.push(n as Element);
  }
  for (const el of els) for (const a of Array.from(el.attributes)) if (/[]/.test(a.value)) el.setAttribute(a.name, STRIP(a.value));
  for (const t of texts) {
    if (!t.isConnected) continue;
    const d = t.data;
    const parent = t.parentElement;
    const inSvg = !!parent && parent.namespaceURI === "http://www.w3.org/2000/svg";
    if (!parent || inSvg || parent.closest("[data-path]")) {
      t.data = STRIP(d);
      continue;
    }
    const opens = (d.match(//g) || []).length, closes = (d.match(//g) || []).length;
    if (opens > 0 && opens === closes) {
      const frag = document.createDocumentFragment();
      let last = 0, m: RegExpExecArray | null;
      MARK_RE.lastIndex = 0;
      while ((m = MARK_RE.exec(d))) {
        if (m.index > last) frag.appendChild(document.createTextNode(d.slice(last, m.index)));
        const s = document.createElement("span");
        s.className = "ted";
        s.dataset.path = m[1];
        s.contentEditable = "true";
        s.spellcheck = false;
        s.textContent = m[2];
        frag.appendChild(s);
        last = m.index + m[0].length;
      }
      if (last < d.length) frag.appendChild(document.createTextNode(STRIP(d.slice(last))));
      t.replaceWith(frag);
    } else {
      // the text runs across tags (<b>, <br>): the element holding it becomes the editable
      const m = /([^]+)/.exec(parent.textContent || "");
      if (m && !parent.dataset.path) {
        parent.dataset.path = m[1];
        parent.classList.add("ted");
        parent.contentEditable = "true";
        parent.spellcheck = false;
      }
      const w2 = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
      let x: Node | null;
      while ((x = w2.nextNode())) {
        const tx = x as Text;
        if (/[]/.test(tx.data)) tx.data = STRIP(tx.data);
      }
    }
  }
}

/** What an editable holds now, as the content string should read: <b> and <br> kept, Chrome's divs turned into breaks. */
export function readEditable(el: HTMLElement): string {
  let h = el.innerHTML;
  h = h.replace(/<div><br><\/div>/g, "<br>").replace(/<div>/g, "<br>").replace(/<\/div>/g, "").replace(/&nbsp;/g, " ");
  h = h.replace(/<span class="ted"[^>]*>|<\/span>/g, "");
  h = h.replace(/<br>$/, "").trim();
  const tmp = document.createElement("div");
  tmp.innerHTML = h;
  // plain text when no markup is left - keep & < > as the author typed them
  return tmp.querySelector("*") ? h : tmp.textContent || "";
}

export const PHASES: { id: Phase; he: string; zone: boolean }[] = [
  { id: "welcome", he: "פתיחה", zone: false },
  { id: "setup", he: "בניית האי", zone: false },
  { id: "ready", he: "יוצאים לדרך", zone: false },
  { id: "sail", he: "בחירת אי", zone: false },
  { id: "tide", he: "גאות", zone: false },
  { id: "fog", he: "ערפל", zone: false },
  { id: "lighthouse", he: "מגדלור", zone: false },
  { id: "market", he: "שוק", zone: false },
  { id: "gate", he: "שער האי", zone: true },
  { id: "howto", he: "איך משחקים", zone: true },
  { id: "task", he: "משימה", zone: true },
  { id: "result", he: "תוצאה", zone: true },
  { id: "flip", he: "הפיכה", zone: true },
  { id: "finale", he: "אי השפיות", zone: false },
  { id: "finale2", he: "סיכום", zone: false },
  { id: "invite", he: "הזמנה", zone: false },
];
export const ZONES_HE: { id: ZoneId; he: string }[] = [
  { id: "cave", he: "המערה" },
  { id: "lake", he: "האגם" },
  { id: "forest", he: "היער" },
  { id: "observatory", he: "מצפה הכוכבים" },
  { id: "reef", he: "ריף האלמוגים" },
  { id: "safari", he: "הספארי" },
];
export const screenId = (phase: string, zone: string | null) => (PHASES.find((p) => p.id === phase)?.zone && zone ? `${phase}:${zone}` : phase);

export interface EditStore {
  edits: Map<string, string>;
  screens: Map<string, { visited: boolean; edited: number }>;
  note: string;
}

export async function loadStore(): Promise<EditStore> {
  const store: EditStore = { edits: new Map(), screens: new Map(), note: "" };
  try {
    const r = await fetch("/api/sanity/texts", { cache: "no-store" });
    if (!r.ok) return store;
    const j = (await r.json()) as { rows?: { key: string; kind: string; text: string | null; screen: string | null }[] };
    for (const row of j.rows ?? []) {
      if (row.kind === "text" && row.text != null) store.edits.set(row.key, row.text);
      else if (row.kind === "screen") store.screens.set(row.key, { visited: true, edited: 0 });
      else if (row.kind === "note" && row.key === "general") store.note = row.text ?? "";
    }
    for (const row of j.rows ?? []) {
      if (row.kind === "text" && row.text != null && row.screen) {
        const s = store.screens.get(row.screen) ?? { visited: true, edited: 0 };
        s.edited++;
        store.screens.set(row.screen, s);
      }
    }
  } catch {
    /* offline: the page still edits, nothing is kept */
  }
  return store;
}

export async function putRow(body: { kind: "text" | "screen" | "note"; key: string; text: string | null; original?: string | null; screen?: string | null }): Promise<boolean> {
  try {
    const r = await fetch("/api/sanity/texts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.ok;
  } catch {
    return false;
  }
}

/** The bar on top: every screen as a chip (seen / changed / not yet), the island for the island screens, the notes. */
export function createEditBar(host: HTMLElement, store: EditStore, jump: (phase: Phase, zone: ZoneId) => void, note: (text: string) => void): { update(phase: string, zone: string | null): void; destroy(): void } {
  const bar = document.createElement("div");
  bar.className = "edbar";
  bar.dir = "rtl";
  let zone: ZoneId = "cave";
  let current = "";
  const zoneSel = document.createElement("select");
  zoneSel.className = "edsel";
  zoneSel.title = "האי של מסכי האי";
  for (const z of ZONES_HE) {
    const o = document.createElement("option");
    o.value = z.id;
    o.textContent = z.he;
    zoneSel.appendChild(o);
  }
  zoneSel.addEventListener("change", () => {
    zone = zoneSel.value as ZoneId;
    paint();
  });
  const chips = document.createElement("div");
  chips.className = "edchips";
  const status = document.createElement("span");
  status.className = "edstatus";
  const noteBtn = document.createElement("button");
  noteBtn.type = "button";
  noteBtn.className = "edbtn";
  noteBtn.textContent = "הנחיות לקלוד";
  const notePop = document.createElement("div");
  notePop.className = "ednote";
  notePop.hidden = true;
  const ta = document.createElement("textarea");
  ta.placeholder = "הנחיות כלליות על המשחק, למשל: ״בכל המשחק להחליף אסימונים במטבעות״. נשמר לבד.";
  ta.value = store.note;
  let noteTimer: ReturnType<typeof setTimeout> | null = null;
  ta.addEventListener("input", () => {
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => note(ta.value), 600);
  });
  notePop.appendChild(ta);
  noteBtn.addEventListener("click", () => {
    notePop.hidden = !notePop.hidden;
    if (!notePop.hidden) ta.focus();
  });
  const legend = document.createElement("span");
  legend.className = "edlegend";
  legend.innerHTML = '<i class="s-edited"></i>שונה <i class="s-seen"></i>נראה <i class="s-new"></i>עוד לא';
  bar.append(zoneSel, chips, status, noteBtn, legend);
  host.appendChild(bar);
  host.appendChild(notePop);
  function paint() {
    chips.innerHTML = "";
    for (const p of PHASES) {
      const sid = screenId(p.id, p.zone ? zone : null);
      const st = store.screens.get(sid);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "edchip " + (st && st.edited ? "s-edited" : st && st.visited ? "s-seen" : "s-new") + (sid === current ? " on" : "");
      b.textContent = p.he + (st && st.edited ? " · " + st.edited : "");
      b.title = p.zone ? p.he + " · " + (ZONES_HE.find((z) => z.id === zone)?.he ?? "") : p.he;
      b.addEventListener("click", () => jump(p.id, zone));
      chips.appendChild(b);
    }
    let seen = 0, edited = 0;
    for (const s of store.screens.values()) {
      if (s.visited) seen++;
      if (s.edited) edited++;
    }
    status.textContent = `נראו ${seen} · שונו ${edited} מסכים · ${store.edits.size} טקסטים`;
  }
  paint();
  return {
    update(phase, z) {
      if (z && ZONES_HE.some((x) => x.id === z) && zoneSel.value !== z) {
        zone = z as ZoneId;
        zoneSel.value = z;
      }
      current = screenId(phase, z);
      paint();
    },
    destroy() {
      bar.remove();
      notePop.remove();
    },
  };
}
