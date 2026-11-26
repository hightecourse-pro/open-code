"use client";
// ============================================================================
// הסטודיו · the control room of המסע לאי השפיות (the kit's studio.js, rewritten
// on the app's API): the events, the tablets' addresses, the remote for the
// hall screen, the melody, the song (+ Suno), the shapes, the reveal.
// The studio speaks to the producer (feminine); the game's own texts follow
// the event's gender switch.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildContent, COLORS, ZONE_IDS, isZoneId, type Gender, type ZoneId } from "@/lib/sanity/content";
import { icon, logo, nameOf, token as tokenArt } from "@/lib/sanity/art";
import { studioGet, studioPost } from "@/lib/sanity/client";
import { photoPath, shortPath, tabletPath, type CreationMeta, type EventInfo, type HallScene, type StudioView } from "@/lib/sanity/shared";
import { loadQr, qrSvg as makeQrSvg } from "@/lib/sanity/qr";
import { Kaleido, SUNO_STYLES, buildScore, logoFromNumbers, midiBlob, photoToLogo, playScore, renderWav, sunoPack, type Player } from "@/lib/sanity/creations";
import type { Snapshot } from "@/lib/sanity/engine";
import { Sim } from "./sim";

type TabId = "event" | "hall" | "melody" | "song" | "shapes" | "reveal";
const TABS: [TabId, string, string][] = [
  ["event", "האירוע", "flag"],
  ["hall", "מסך האולם", "screen"],
  ["melody", "המנגינה", "wave"],
  ["song", "השיר", "speech"],
  ["shapes", "הצורות", "tiles"],
  ["reveal", "החשיפה", "star"],
];
const POLL_MS = 2500;
const SIM_MS = 1200;
const SIM_SPEED = 3;

type Act = (body: Record<string, unknown>) => Promise<boolean>;
const Html = ({ html, className, tag: Tag = "span" }: { html: string; className?: string; tag?: "span" | "div" }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
const download = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const copyText = async (t: string, btn?: HTMLButtonElement | null) => {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    return;
  }
  if (btn) {
    const o = btn.textContent;
    btn.textContent = "הועתק ✓";
    setTimeout(() => {
      btn.textContent = o;
    }, 1400);
  }
};
const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", timeZone: "Asia/Jerusalem" });
const circlesOf = (view: StudioView): Record<number, Snapshot> => Object.fromEntries(view.hall.circles.map((c) => [c.circle, c]));
const creationsOf = (view: StudioView): CreationMeta[] => [...view.hall.creations].sort((a, b) => a.circle - b.circle);

export function Studio({ initial, userName }: { initial: StudioView; userName: string }) {
  const [view, setView] = useState<StudioView>(initial);
  const [tab, setTab] = useState<TabId>("event");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [simOn, setSimOn] = useState(false);
  const simRef = useRef<{ sim: Sim; timer: ReturnType<typeof setTimeout> | null; alive: boolean } | null>(null);
  const logosRef = useRef<Record<number, string>>({});
  const active = view.events.find((e) => e.slug === view.active) ?? null;
  const content = useMemo(() => buildContent(active?.gender ?? "m"), [active?.gender]);

  // every action bumps the sequence; a poll that started before it is thrown away (it would paint the old picture over the new one)
  const seq = useRef(0);
  const act: Act = useCallback(async (body) => {
    seq.current++;
    setBusy(true);
    const j = await studioPost(body);
    setBusy(false);
    if (j.ok) {
      setView(j.view);
      setErr(null);
      return true;
    }
    setErr(j.error || "משהו לא עבד. נסי שוב.");
    return false;
  }, []);

  // the view refreshes itself, unless the producer is typing in a form
  useEffect(() => {
    let alive = true;
    const t = setInterval(async () => {
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest(".hk-studio")) return;
      const started = seq.current;
      try {
        const v = await studioGet();
        if (alive && seq.current === started) setView(v);
      } catch {
        /* the next tick */
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // the simulation: 30 virtual circles, written into the active event every tick
  const stopSim = useCallback(() => {
    const s = simRef.current;
    if (s) {
      s.alive = false;
      if (s.timer) clearTimeout(s.timer);
    }
    simRef.current = null;
    setSimOn(false);
  }, []);
  const startSim = useCallback(
    (slug: string, circles: number) => {
      stopSim();
      const s = { sim: new Sim(circles, SIM_SPEED), timer: null as ReturnType<typeof setTimeout> | null, alive: true };
      simRef.current = s;
      setSimOn(true);
      const loop = async () => {
        if (!s.alive) return;
        const rows = s.sim.tick();
        seq.current++;
        const j = await studioPost({ action: "sim", slug, rows });
        if (!s.alive) return;
        if (j.ok) setView(j.view);
        else setErr(j.error);
        if (s.sim.done) {
          stopSim();
          return;
        }
        s.timer = setTimeout(loop, SIM_MS);
      };
      void loop();
    },
    [stopSim],
  );
  useEffect(() => () => stopSim(), [stopSim]);

  const tokenOf = (circle: number) => view.tokens.find((t) => t.circle === circle)?.token ?? null;
  const firstTablet = view.tokens[0] ? tabletPath(view.tokens[0].token) : null;

  return (
    <div className="hk-studio" data-testid="studio-shell">
      <div id="app">
        <aside className="nav-side">
          <Html html={logo(120)} />
          <h1>הסטודיו</h1>
          <p className="mode" data-testid="studio-mode">
            {active ? (
              <>
                <i className="ok" />
                מחובר · {active.name} ({active.slug})
              </>
            ) : (
              <>
                <i />
                אין אירוע פעיל
              </>
            )}
          </p>
          <nav>
            {TABS.map(([id, name, ic]) => (
              <button key={id} type="button" data-tab={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                <Html html={icon(ic, 34, tab === id ? "#fff" : "#0062AF")} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="links">
            <a href="/sanity/hall?wide=1" target="_blank" rel="noreferrer">
              פתיחת מסך האולם ↗
            </a>
            {firstTablet ? (
              <a href={firstTablet} target="_blank" rel="noreferrer">
                פתיחת טאבלט 1 ↗
              </a>
            ) : null}
            <SignOut name={userName} />
          </div>
        </aside>
        <main className="pane" id="pane" data-tab={tab}>
          {err ? (
            <p className="st-err" role="alert" data-testid="studio-error">
              {err}
              <button type="button" onClick={() => setErr(null)} aria-label="סגירה">
                ✕
              </button>
            </p>
          ) : null}
          {tab === "event" ? <EventTab view={view} active={active} act={act} busy={busy} content={content} simOn={simOn} startSim={startSim} stopSim={stopSim} tokenOf={tokenOf} /> : null}
          {tab === "hall" ? <HallTab view={view} active={active} act={act} /> : null}
          {tab === "melody" ? <MelodyTab view={view} content={content} /> : null}
          {tab === "song" ? <SongTab view={view} /> : null}
          {tab === "shapes" ? <ShapesTab view={view} logosRef={logosRef} /> : null}
          {tab === "reveal" ? <RevealTab view={view} active={active} act={act} content={content} /> : null}
        </main>
      </div>
    </div>
  );
}

function SignOut({ name }: { name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="st-signout"
      disabled={pending}
      data-testid="studio-signout"
      onClick={async () => {
        setPending(true);
        try {
          await createClient().auth.signOut();
        } catch {
          /* the refresh shows the state we are in */
        }
        router.refresh();
      }}
    >
      {name ? `${name} · ` : ""}
      {pending ? "רגע..." : "יציאה"}
    </button>
  );
}

// ---------- האירוע ----------
function EventTab({ view, active, act, busy, content, simOn, startSim, stopSim, tokenOf }: { view: StudioView; active: EventInfo | null; act: Act; busy: boolean; content: ReturnType<typeof buildContent>; simOn: boolean; startSim: (slug: string, circles: number) => void; stopSim: () => void; tokenOf: (circle: number) => string | null }) {
  // ״QR״ per circle (the owner, 25.11): the tablet's address as a code, big, for a replacement device to scan off the studio's screen
  const [qr, setQr] = useState<number | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const closeQr = () => {
    setQr(null);
    setQrSvg("");
  };
  useEffect(() => {
    if (qr == null) return;
    const token = tokenOf(qr);
    if (!token) return;
    // the code carries the short address (26.11): what is printed is what is scanned, and both land on the token
    const url = location.origin + shortPath(qr);
    let alive = true;
    loadQr()
      .then((lib) => {
        if (alive) setQrSvg(makeQrSvg(lib, url));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, view.tokens]);
  const circles = circlesOf(view);
  const L = view.hall.circles;
  const by = (f: (c: Snapshot) => boolean) => L.filter(f).length;
  const N = active?.circles ?? 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  // ״מסך אחורה״: the screens of a circle in the studio's words
  const PH_HE: Record<string, string> = { welcome: "פתיחה", setup: "בניית האי", ready: "יוצאים לדרך", tide: "גאות", sail: "בחירת אי", sailing: "הפלגה", fog: "ערפל", lighthouse: "מגדלור", lhDone: "מגדלור", market: "שוק החליפין", flip: "הפיכת כרטיס", gate: "שער האי", howto: "איך משחקים", task: "משימה", result: "תוצאה", finale: "אי השפיות", finale2: "סיכום", invite: "הזמנה" };
  const ZONE_HE: Record<string, string> = { cave: "המערה", lake: "האגם", forest: "היער", observatory: "מצפה הכוכבים", reef: "ריף האלמוגים", safari: "הספארי", fog: "הערפל", lighthouse: "המגדלור", market: "שוק החליפין", sanity: "אי השפיות" };
  const stepLabel = (st: { phase: string; zone: string | null }) => (PH_HE[st.phase] ?? st.phase) + (st.zone && ZONE_HE[st.zone] ? " · " + ZONE_HE[st.zone] : "");
  const status = (n: number): [string, string] => {
    const c = circles[n];
    if (!c) return ["ממתין", "#9CB3C9"];
    if (c.finished) return ["באי השפיות", "#E0A800"];
    if (c.stage >= 1) return isZoneId(c.zone) ? [nameOf(c.zone), COLORS[c.zone]] : ["בדרך", "#0062AF"];
    return ["פתיחה", "#0062AF"];
  };
  const urlOf = (circle: number) => {
    const t = tokenOf(circle);
    return t ? `${origin}${tabletPath(t)}` : "";
  };
  const shortOf = (circle: number) => `${origin}${shortPath(circle)}`;
  const allUrls = () => [...Array(N)].map((_, i) => `מעגל ${i + 1}: ${urlOf(i + 1)}`).join("\n");
  const [creating, setCreating] = useState(false);

  return (
    <>
      <header>
        <h2>האירוע</h2>
        <p>{active ? `${active.circles} טאבלטים, מסך אולם אחד, הכול בזמן אמת.` : "עוד אין אירוע. יוצרים אחד למטה, והוא נהיה האירוע הפעיל."}</p>
      </header>
      {active ? (
        <div className="kpis" data-testid="studio-kpis">
          <div>
            <b>{by((c) => c.stage >= 1 && !c.finished)}</b>
            <span>במסע</span>
          </div>
          <div>
            <b>{by((c) => c.finished)}</b>
            <span>הגיעו לאי</span>
          </div>
          <div>
            <b>{L.reduce((s, c) => s + (c.total || 0), 0)}</b>
            <span>אסימונים</span>
          </div>
          <div>
            <b>
              {creationsOf(view).filter((c) => c.sentence).length}/{N}
            </b>
            <span>שורות לשיר</span>
          </div>
        </div>
      ) : null}

      <section className="card" data-testid="studio-events">
        <div className="st-cardhead">
          <h3>האירועים</h3>
          <button type="button" className="sbtn small" onClick={() => setCreating((v) => !v)} data-testid="studio-new-event">
            {creating ? "סגירה" : "אירוע חדש"}
          </button>
        </div>
        <p className="hint">אירוע הוא ריצה אחת של המשחק: החזרה הגנרלית ויום הכנס הם שני אירועים, לכל אחד הטאבלטים והכתובות שלו. הטאבלטים ומסך האולם עובדים על האירוע הפעיל.</p>
        {creating ? <NewEventForm act={act} busy={busy} onDone={() => setCreating(false)} /> : null}
        <div className="evlist">
          {view.events.map((e) => (
            // keyed by the saved values too: a change from the server remounts the row with fresh fields
            <EventRow key={`${e.slug}|${e.name}|${e.gender}|${e.circles}`} e={e} act={act} busy={busy} />
          ))}
          {!view.events.length ? <p className="hint">עוד אין אירועים.</p> : null}
        </div>
      </section>

      {active ? (
        <>
          <section className="card" data-testid="studio-tablets">
            <h3>הטאבלטים</h3>
            <p className="hint">כל טאבלט נפתח בכתובת משלו (הרשימה למטה). בטאבלט: פותחים את הכתובת ב-Chrome, תפריט ⋮ ← ״הוספה למסך הבית״ ← ״התקנה״, ומכאן פותחים מהאייקון: מסך מלא, לרוחב, בלי שורת כתובת, והמסך לא נכבה במהלך המשחק.</p>
            <div className="tabgrid">
              {[...Array(N)].map((_, i) => {
                const [s, c] = status(i + 1);
                const ci = circles[i + 1];
                const t = tokenOf(i + 1);
                return (
                  <a key={i} className="tb" href={t ? tabletPath(t) : "#"} target="_blank" rel="noreferrer" style={{ "--c": c } as CSSProperties} data-testid={`studio-tablet-${i + 1}`}>
                    <b>{i + 1}</b>
                    <span>{s}</span>
                    {ci ? <em>{ci.total}</em> : null}
                  </a>
                );
              })}
            </div>
          </section>

          <section className="card" data-testid="studio-urls">
            <div className="st-cardhead">
              <h3>כתובות הטאבלטים</h3>
              <button type="button" className="sbtn ghost small" onClick={(e) => copyText(allUrls(), e.currentTarget)} data-testid="studio-copy-all">
                העתקת כל הרשימה
              </button>
              <a className="sbtn ghost small" href="/sanity/studio/qr-sheet?print=1" target="_blank" rel="noopener" data-testid="studio-qr-sheet" title="30 כרטיסי QR לגזירה, שישה בעמוד; בחלון ההדפסה בוחרים ״שמירה כ-PDF״">
                גיליון QR לכל הטאבלטים (PDF)
              </a>
            </div>
            <p className="hint">הכתובת היא המפתח של המעגל: מכשיר שפותח אותה ממשיך את המשחק של המעגל מאיפה שנעצר. ״איפוס״ מתחיל את המעגל הזה מההתחלה (מוחק את המשחק שלו). ״מסך אחורה״ פותח את רשימת כל המסכים שהמעגל עבר: בוחרים לאן לחזור, והמסך נפתח מחדש בלי הבחירה שנעשתה בו (משימה מקבלת את כל הזמן מחדש); הטאבלט עובר לשם לבד תוך עשר שניות.</p>
            <ol className="urllist">
              {[...Array(N)].map((_, i) => {
                const u = urlOf(i + 1);
                const [s, c] = status(i + 1);
                return (
                  <li key={i}>
                    <b>{i + 1}</b>
                    <code dir="ltr" className="short">{shortOf(i + 1)}</code>
                    <code dir="ltr">{u}</code>
                    <span className="st-badge" style={{ background: c }}>
                      {s}
                    </span>
                    <button type="button" className="sbtn ghost small" onClick={(e) => copyText(u, e.currentTarget)} data-testid={`studio-copy-${i + 1}`}>
                      העתקה
                    </button>
                    <button type="button" className="sbtn ghost small" onClick={() => setQr(i + 1)} data-testid={`studio-qr-${i + 1}`} title="הקוד של המעגל במסך גדול, לסריקה ממכשיר חלופי">
                      QR
                    </button>
                    <button
                      type="button"
                      className="sbtn ghost small st-danger"
                      disabled={busy || !circles[i + 1]}
                      onClick={() => {
                        if (window.confirm(`לאפס את מעגל ${i + 1}? המשחק שלו יימחק והטאבלט יתחיל מההתחלה.`)) void act({ action: "reset-circle", slug: active.slug, circle: i + 1 });
                      }}
                    >
                      איפוס
                    </button>
                    {(() => {
                      const steps = view.tokens.find((t) => t.circle === i + 1)?.steps ?? [];
                      const back = steps.length - 1; // the last step is the screen the circle is on now
                      return (
                        <select
                          className="sbtn ghost small"
                          value=""
                          disabled={busy || back < 1}
                          title="לאיזה מסך להחזיר את המעגל; הטאבלט עובר לשם תוך עשר שניות"
                          data-testid={"studio-undo-" + (i + 1)}
                          onChange={(e) => {
                            const to = Number(e.target.value);
                            if (!Number.isFinite(to) || !steps[to]) return;
                            if (window.confirm("להחזיר את מעגל " + (i + 1) + " למסך ״" + stepLabel(steps[to]) + "״? הטאבלט יעבור לשם תוך עשר שניות.")) void act({ action: "undo-circle", slug: active.slug, circle: i + 1, to });
                          }}
                        >
                          <option value="">{back > 0 ? "↩ מסך אחורה (" + back + ")" : "↩ מסך אחורה"}</option>
                          {steps
                            .slice(0, -1)
                            .map((st, idx) => (
                              <option key={idx} value={idx}>
                                {stepLabel(st)} · {back - idx} אחורה
                              </option>
                            ))
                            .reverse()}
                        </select>
                      );
                    })()}
                  </li>
                );
              })}
            </ol>
            {qr != null && (
              <div className="st-qr" role="dialog" aria-label={"QR של מעגל " + qr} onClick={closeQr} data-testid="studio-qr-dialog">
                <div className="st-qr-card" onClick={(e) => e.stopPropagation()}>
                  <h3>מעגל {qr}</h3>
                  <div className="st-qr-svg" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  <code dir="ltr" className="short">{shortOf(qr)}</code>
                  <code dir="ltr">{urlOf(qr)}</code>
                  <p className="hint">סורקים במצלמת הטאבלט, או מקלידים בכרום את הכתובת הקצרה (טאבלט בלי סורק); המשחק של המעגל ממשיך מאותו מסך.</p>
                  <button type="button" className="sbtn" onClick={closeQr}>
                    סגירה
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="card row" data-testid="studio-controls">
            <div>
              <h3>התחלה</h3>
              {active.startedAt ? (
                <p className="hint">
                  האירוע התחיל ב-{fmtTime(active.startedAt)} · שעון האולם: <b className="num">{fmtClock(now - new Date(active.startedAt).getTime())}</b>
                </p>
              ) : (
                <p className="hint">מאפס את שעון האולם ומתחיל את האירוע.</p>
              )}
              <button type="button" className="sbtn" disabled={busy} data-testid="studio-start" onClick={() => void act({ action: "start", slug: active.slug })}>
                <Html html={icon("flag", 30, "#fff")} />
                {active.startedAt ? "התחלה מחדש של השעון" : "התחלת האירוע"}
              </button>
            </div>
            <div>
              <h3>סימולציה</h3>
              <p className="hint">{active.circles} מעגלים וירטואליים, כדי לראות את האולם ואת החשיפה בלי טאבלטים. כותבת לתוך האירוע הפעיל ({active.slug}).</p>
              <button
                type="button"
                className="sbtn ghost"
                data-testid="studio-sim"
                onClick={() => {
                  if (simOn) stopSim();
                  else if (window.confirm(`הסימולציה כותבת ${active.circles} מעגלים מדומים לתוך האירוע הפעיל (${active.slug}). להמשיך?`)) startSim(active.slug, active.circles);
                }}
              >
                {simOn ? "עצירת הסימולציה" : "הפעלת הסימולציה"}
              </button>
            </div>
            <div>
              <h3>איפוס</h3>
              <p className="hint">מוחק את כל נתוני האירוע ({active.slug}): המשחקים, היצירות והצילומים. הכתובות של הטאבלטים נשארות. אין דרך חזרה.</p>
              <button
                type="button"
                className="sbtn danger"
                disabled={busy}
                data-testid="studio-reset"
                onClick={() => {
                  const typed = window.prompt(`כדי לאפס, הקלידי את מזהה האירוע (${active.slug})`);
                  if (typed !== null && typed.trim() === active.slug) {
                    stopSim();
                    void act({ action: "reset", slug: active.slug });
                  }
                }}
              >
                איפוס האירוע
              </button>
            </div>
          </section>
          <p className="hint">הלשון במשחק: {active.gender === "f" ? "נקבה" : "זכר"} · {content.GAME.title}</p>
        </>
      ) : null}
    </>
  );
}

function NewEventForm({ act, busy, onDone }: { act: Act; busy: boolean; onDone: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [circles, setCircles] = useState(30);
  const [gender, setGender] = useState<Gender>("m");
  return (
    <form
      className="evform"
      data-testid="studio-event-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act({ action: "event-create", slug: slug.trim().toLowerCase(), name: name.trim(), circles, gender })) {
          setSlug("");
          setName("");
          onDone();
        }
      }}
    >
      <label>
        מזהה (באנגלית)
        <input dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="haitekors-2026" pattern="[a-z0-9][a-z0-9\-]{1,39}" required />
      </label>
      <label>
        שם
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="הייטקורס 2026 · יום חמישי" required />
      </label>
      <label>
        מעגלים
        <input type="number" min={1} max={60} value={circles} onChange={(e) => setCircles(+e.target.value)} />
      </label>
      <fieldset>
        <legend>לשון</legend>
        <label>
          <input type="radio" name="g-new" checked={gender === "m"} onChange={() => setGender("m")} /> זכר
        </label>
        <label>
          <input type="radio" name="g-new" checked={gender === "f"} onChange={() => setGender("f")} /> נקבה
        </label>
      </fieldset>
      <button type="submit" className="sbtn" disabled={busy}>
        יצירת האירוע
      </button>
    </form>
  );
}

function EventRow({ e, act, busy }: { e: EventInfo; act: Act; busy: boolean }) {
  const [name, setName] = useState(e.name);
  const [gender, setGender] = useState<Gender>(e.gender);
  const [circles, setCircles] = useState(e.circles);
  const dirty = name !== e.name || gender !== e.gender || circles !== e.circles;
  return (
    <div className={`evrow${e.active ? " on" : ""}`} data-testid={`studio-event-${e.slug}`} data-active={e.active ? "1" : "0"}>
      <div className="evmain">
        <code dir="ltr">{e.slug}</code>
        {e.active ? <span className="st-badge gold">פעיל</span> : null}
        <input className="evname" value={name} onChange={(ev) => setName(ev.target.value)} aria-label="שם האירוע" />
        <label className="evnum">
          מעגלים
          <input type="number" min={1} max={60} value={circles} onChange={(ev) => setCircles(+ev.target.value)} />
        </label>
        <fieldset className="evgender">
          <label>
            <input type="radio" name={`g-${e.slug}`} checked={gender === "m"} onChange={() => setGender("m")} /> זכר
          </label>
          <label>
            <input type="radio" name={`g-${e.slug}`} checked={gender === "f"} onChange={() => setGender("f")} /> נקבה
          </label>
        </fieldset>
        <small>
          נוצר {fmtDate(e.createdAt)}
          {e.startedAt ? ` · התחיל ${fmtTime(e.startedAt)}` : ""}
        </small>
      </div>
      <div className="evbtns">
        {dirty ? (
          <button type="button" className="sbtn small" disabled={busy} onClick={() => void act({ action: "event-update", slug: e.slug, name: name.trim(), gender, circles })}>
            שמירה
          </button>
        ) : null}
        {!e.active ? (
          <button type="button" className="sbtn ghost small" disabled={busy} data-testid={`studio-activate-${e.slug}`} onClick={() => void act({ action: "event-activate", slug: e.slug })}>
            הפעלה
          </button>
        ) : null}
        {!e.active ? (
          <button
            type="button"
            className="sbtn ghost small st-danger"
            disabled={busy}
            data-testid={`studio-delete-${e.slug}`}
            onClick={() => {
              if (window.confirm(`למחוק את האירוע ${e.slug} על כל הנתונים שלו?`)) void act({ action: "event-delete", slug: e.slug });
            }}
          >
            מחיקה
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------- מסך האולם (the remote) ----------
const SCENES: [HallScene, string, string][] = [
  ["auto", "אוטומטי", "מתחלף לבד כל כמה עשרות שניות"],
  ["map", "מבט רחפן", "הים, אי השפיות והספינות"],
  ["focus", "זום אין", "מעגל אחד מקרוב"],
  ["compare", "ראש בראש", "שני מעגלים זה מול זה"],
  ["race", "המירוץ", "כל המעגלים בשורות"],
  ["stats", "המספרים", "מה האולם אסף"],
  ["grand", "סצנת הסיום", "שער היער עם סכומי כל האולם"],
];
function HallTab({ view, active, act }: { view: StudioView; active: EventInfo | null; act: Act }) {
  const N = active?.circles ?? 30;
  const [fc, setFc] = useState<string>(active?.focusCircle ? String(active.focusCircle) : "");
  const [c1, setC1] = useState(active?.compare?.[0] ?? 1);
  const [c2, setC2] = useState(active?.compare?.[1] ?? 2);
  const cur = active?.hallScene ?? "auto";
  // the venue's wall is 8 m × 2 m (the owner, 23.11): the computer sends an ordinary 16:9 signal, the picture inside it must be 4:1, the wall's processor fits it
  const hallUrl = active ? `/sanity/hall?event=${encodeURIComponent(active.slug)}&wide=1` : "/sanity/hall?wide=1";
  if (!active) return <header><h2>מסך האולם</h2><p>אין אירוע פעיל. יוצרים אירוע בלשונית ״האירוע״.</p></header>;
  return (
    <>
      <header>
        <h2>מסך האולם</h2>
        <p>שלט רחוק. מה שבוחרים כאן מופיע מיד על המסך הגדול.</p>
      </header>
      <section className="card" data-testid="studio-scenes">
        <h3>סצנה</h3>
        <div className="scenes">
          {SCENES.map(([id, n, d]) => (
            <button key={id} type="button" className={`scn ${cur === id ? "on" : ""}`} data-s={id} onClick={() => void act({ action: "control", slug: active.slug, hallScene: id, focusCircle: null, compare: null })}>
              <b>{n}</b>
              <span>{d}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card row">
        <div>
          <h3>זום אין למעגל</h3>
          <div className="pick">
            <select id="fc" value={fc} onChange={(e) => setFc(e.target.value)} aria-label="מעגל">
              <option value="">אקראי</option>
              {[...Array(N)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <button type="button" className="sbtn" data-testid="studio-focus" onClick={() => void act({ action: "control", slug: active.slug, hallScene: "focus", focusCircle: fc ? +fc : null, compare: null })}>
              הצגה
            </button>
          </div>
        </div>
        <div>
          <h3>ראש בראש</h3>
          <div className="pick">
            <select value={c1} onChange={(e) => setC1(+e.target.value)} aria-label="מעגל ראשון">
              {[...Array(N)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span>מול</span>
            <select value={c2} onChange={(e) => setC2(+e.target.value)} aria-label="מעגל שני">
              {[...Array(N)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <button type="button" className="sbtn" data-testid="studio-compare" onClick={() => void act({ action: "control", slug: active.slug, hallScene: "compare", compare: [c1, c2], focusCircle: null })}>
              הצגה
            </button>
          </div>
        </div>
      </section>
      <section className="card">
        <h3>תצוגה מקדימה</h3>
        <iframe src={hallUrl} className="preview" title="מסך האולם" />
        <p className="hint">
          הכתובת למחשב של מסך האולם:{" "}
          <a href={hallUrl} target="_blank" rel="noreferrer">
            {hallUrl}
          </a>{" "}
          · מסך מלא במקש F.
        </p>
        <p className="hint">התמונה ביחס 4:1 (מסך 8×2): על מסך 16:9 היא פס באמצע, עם שחור מעל ומתחת. הבקר של המסך לוקח את הפס ומתאים אותו לקיר. בלי ‎wide=1‎ בכתובת המסך מצייר פריסת 16:9 רגילה.</p>
      </section>
      <p className="hint">{view.hall.circles.length} מעגלים משדרים כרגע.</p>
    </>
  );
}

// ---------- המנגינה ----------
function spark(arr: number[], c = "#E94BA3") {
  const W = 220,
    H = 60;
  if (!arr || !arr.length) return `<svg width="${W}" height="${H}"></svg>`;
  const pts = arr.map((v, i) => [10 + (i * (W - 20)) / Math.max(1, arr.length - 1), H - 8 - (v / 12) * (H - 16)]);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${pts.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ")}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#fff" stroke="${c}" stroke-width="2"/>`).join("")}</svg>`;
}
function MelodyTab({ view, content }: { view: StudioView; content: ReturnType<typeof buildContent> }) {
  const L = useMemo(() => creationsOf(view).filter((c) => c.standing && c.standing.length >= 5), [view]);
  const score = useMemo(() => buildScore(L), [L]);
  const statements = content.TASKS.reef.statements;
  const avg = statements.map((_, i) => (L.length ? L.reduce((s, c) => s + (c.standing[i] || 0), 0) / L.length : 0));
  const [player, setPlayer] = useState<Player | null>(null);
  const [wavBusy, setWavBusy] = useState(false);
  useEffect(() => () => player?.stop(), [player]);
  return (
    <>
      <header>
        <h2>המנגינה</h2>
        <p>כל מעגל: 5 אמירות, כמה עמדו בכל אחת. כל מספר הופך לצליל, וכל מעגל הוא משפט של 2 תיבות. בין כל 6 מעגלים חוזר פזמון: הממוצע של כל האולם. {L.length} מנגינות מוכנות.</p>
      </header>
      <section className="card row">
        <div>
          <h3>המנגינה של כל האולם</h3>
          <p className="hint">
            {Math.floor(score.length / 60)}:{String(Math.round(score.length % 60)).padStart(2, "0")} דקות · {(score.sections || []).filter((x) => x.kind === "verse").length} בתים · דו מז׳ור, סולם פנטטוני · ליווי I–vi–IV–V
          </p>
          <div className="btns">
            <button
              type="button"
              className="sbtn"
              data-testid="studio-play"
              onClick={() => {
                if (player) {
                  player.stop();
                  setPlayer(null);
                } else setPlayer(playScore(score));
              }}
            >
              <Html html={icon("wave", 30, "#fff")} />
              {player ? "עצירה" : "השמעה"}
            </button>
            <button
              type="button"
              className="sbtn ghost"
              disabled={wavBusy}
              onClick={async () => {
                setWavBusy(true);
                try {
                  download(await renderWav(score), "hamasa-melody.wav");
                } finally {
                  setWavBusy(false);
                }
              }}
            >
              {wavBusy ? "מכינה..." : "הורדה כ-WAV"}
            </button>
            <button type="button" className="sbtn ghost" onClick={() => download(midiBlob(score), "hamasa-melody.mid")}>
              הורדה כ-MIDI
            </button>
          </div>
          <p className="hint">את קובץ ה-WAV אפשר להעלות ל-Suno כבסיס לשיר (Upload Audio / Cover).</p>
        </div>
        <div>
          <h3>מה האולם הסכים</h3>
          {statements.map((s, i) => (
            <div className="agree" key={i}>
              <span>{s}</span>
              <i style={{ width: `${(avg[i] / 12) * 100}%` }} />
              <b>{avg[i].toFixed(1)}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h3>המנגינה של כל מעגל</h3>
        <div className="mgrid">
          {L.length ? (
            L.map((c) => (
              <div className="mel" key={c.circle}>
                <b>מעגל {c.circle}</b>
                <Html html={spark(c.standing)} />
                <span className="num">{c.standing.join(" · ")}</span>
              </div>
            ))
          ) : (
            <p className="hint">עוד אין מעגלים שסיימו את ריף האלמוגים.</p>
          )}
        </div>
      </section>
    </>
  );
}

// ---------- השיר + Suno ----------
interface SunoTask {
  id: string;
  status: string;
  tracks: { audioUrl: string; title: string }[];
}
function SongTab({ view }: { view: StudioView }) {
  const N = view.events.find((e) => e.slug === view.active)?.circles ?? 30;
  const [styleId, setStyleId] = useState<string>("ballad");
  const cl = useMemo(() => creationsOf(view), [view]);
  const pack = useMemo(() => sunoPack(cl, styleId), [cl, styleId]);
  // the words the system arranged, until the producer edits them (then hers stay, whatever the feed brings)
  const [ownLyrics, setLyrics] = useState(pack.lyrics);
  const [edited, setEdited] = useState(false);
  const lyrics = edited ? ownLyrics : pack.lyrics;
  const [task, setTask] = useState<SunoTask | null>(null);
  const [sunoMsg, setSunoMsg] = useState<string | null>(null);
  const claudePrompt = `פתח את https://suno.com/create בדפדפן שלי (Chrome).\n1. עבור למצב Custom.\n2. בשדה Lyrics הדבק בדיוק את המילים שלמטה.\n3. בשדה Style הדביקי: ${pack.style}\n4. בשדה Exclude styles (אם קיים): ${pack.exclude}\n5. כותרת: ${pack.title}\n6. לחצי Create, חכי שיסתיים, והורידי את שתי הגרסאות לתיקיית ההורדות.\n\nהמילים:\n${lyrics}`;
  // Suno: generate, then ask every 10s until the tracks are there
  useEffect(() => {
    if (!task || task.tracks.length) return;
    const t = setTimeout(async () => {
      const r = await fetch("/api/sanity/suno", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status", taskId: task.id }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; status?: string; tracks?: SunoTask["tracks"]; error?: string } | null;
      if (j?.ok) setTask({ ...task, status: j.status ?? "...", tracks: (j.tracks ?? []).filter((x) => x.audioUrl) });
      else setTask({ ...task, status: j?.error ?? "..." });
    }, 10000);
    return () => clearTimeout(t);
  }, [task]);
  const generate = async () => {
    setSunoMsg("שולחת ל-Suno...");
    const r = await fetch("/api/sanity/suno", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "generate", title: pack.title, style: pack.style, lyrics, exclude: pack.exclude }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; taskId?: string; error?: string } | null;
    if (j?.ok && j.taskId) {
      setTask({ id: j.taskId, status: "PENDING", tracks: [] });
      setSunoMsg(null);
    } else setSunoMsg(`משהו לא עבד: ${(j?.error ?? `השרת ענה ${r.status}`).slice(0, 160)}`);
  };
  return (
    <>
      <header>
        <h2>השיר</h2>
        <p>
          {pack.song.lines.length} שורות מ-{N} מעגלים. המערכת מסדרת אותן לבתים ולפזמון ומכינה הכול ל-Suno.
        </p>
      </header>
      <section className="card">
        <h3>1. בוחרים סגנון</h3>
        <div className="scenes">
          {SUNO_STYLES.map((s) => (
            <button key={s.id} type="button" className={`scn ${styleId === s.id ? "on" : ""}`} data-st={s.id} onClick={() => setStyleId(s.id)}>
              <b>{s.name}</b>
              <span dir="ltr">{s.style.split(",").slice(0, 3).join(",")}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card two">
        <div>
          <h3>2. המילים (אפשר לערוך)</h3>
          <textarea
            id="lyr"
            rows={18}
            value={lyrics}
            data-testid="studio-lyrics"
            onChange={(e) => {
              setLyrics(e.target.value);
              setEdited(true);
            }}
          />
          {edited ? (
            <button
              type="button"
              className="sbtn ghost small"
              onClick={() => {
                setEdited(false);
                setLyrics(pack.lyrics);
              }}
            >
              חזרה למילים שהמערכת סידרה
            </button>
          ) : null}
        </div>
        <div>
          <h3>3. שולחים ל-Suno</h3>
          <div className="way">
            <b>אוטומטי</b>
            <p className="hint">דרך שירות Suno API (צד שלישי). שתי גרסאות חוזרות לכאן תוך 2–4 דקות.</p>
            <button type="button" className="sbtn" disabled={!view.sunoConfigured} onClick={() => void generate()} data-testid="studio-suno-auto">
              <Html html={icon("star", 30, "#fff")} />
              יצירת השיר עכשיו
            </button>
            {!view.sunoConfigured ? <p className="hint warn">לא מוגדר בשרת (SUNO_API_KEY ו-SUNO_BASE). בינתיים: הדרך הידנית למטה.</p> : null}
            {sunoMsg ? <p className="hint warn">{sunoMsg}</p> : null}
            {task ? (
              <div id="sunoOut">
                {task.tracks.length ? (
                  task.tracks.map((t, i) => (
                    <div className="track" key={i}>
                      <b>גרסה {i + 1}</b>
                      <audio controls src={t.audioUrl} />
                      <a href={t.audioUrl} download>
                        הורדה
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="hint">Suno עובד על זה ({task.status}). בודקת שוב כל 10 שניות.</p>
                )}
              </div>
            ) : null}
          </div>
          <div className="way">
            <b>עם Claude בכרום</b>
            <p className="hint">מעתיקים את ההוראה, פותחים את Claude בכרום ומדביקים. הוא ממלא את Suno ולוחץ על Create.</p>
            <button type="button" className="sbtn ghost" onClick={(e) => copyText(claudePrompt, e.currentTarget)}>
              העתקת ההוראה ל-Claude
            </button>
          </div>
          <div className="way">
            <b>ידני (2 דקות)</b>
            <div className="btns">
              <button type="button" className="sbtn ghost small" onClick={(e) => copyText(pack.style, e.currentTarget)}>
                העתקת הסגנון
              </button>
              <button type="button" className="sbtn ghost small" onClick={(e) => copyText(lyrics, e.currentTarget)} data-testid="studio-copy-lyrics">
                העתקת המילים
              </button>
              <a className="sbtn ghost small" href="https://suno.com/create" target="_blank" rel="noreferrer">
                פתיחת Suno ↗
              </a>
            </div>
            <p className="hint">ב-Suno: Custom → מדביקים מילים וסגנון → Create.</p>
          </div>
          <div className="style-box" dir="ltr">
            {pack.style}
          </div>
        </div>
      </section>
    </>
  );
}

// ---------- הצורות ----------
async function logoOf(slug: string | null, c: CreationMeta, cache: Record<number, string>): Promise<string> {
  if (cache[c.circle]) return cache[c.circle];
  let svg: string | null = null;
  if (c.hasPhoto && slug) svg = await photoToLogo(photoPath(slug, c.circle, c.photoAt)).catch(() => null);
  cache[c.circle] = svg || logoFromNumbers(c.standing, c.circle);
  return cache[c.circle];
}
function ShapesTab({ view, logosRef }: { view: StudioView; logosRef: React.MutableRefObject<Record<number, string>> }) {
  const L = useMemo(() => creationsOf(view), [view]);
  const slug = view.active;
  const canvas = useRef<HTMLCanvasElement>(null);
  const kal = useRef<Kaleido | null>(null);
  const [logos, setLogos] = useState<Record<number, string>>({});
  const [recording, setRecording] = useState(false);
  const added = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!canvas.current) return;
    const k = new Kaleido(canvas.current);
    kal.current = k;
    k.start();
    added.current = new Set();
    return () => k.stop();
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const c of L) {
        const svg = await logoOf(slug, c, logosRef.current);
        if (!alive) return;
        setLogos((m) => (m[c.circle] === svg ? m : { ...m, [c.circle]: svg }));
        if (kal.current && !added.current.has(c.circle)) {
          added.current.add(c.circle);
          await kal.current.add(svg);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [L, slug, logosRef]);
  const record = async () => {
    setRecording(true);
    try {
      const big = document.createElement("canvas");
      big.width = 1920;
      big.height = 1080;
      const k = new Kaleido(big);
      for (const s of Object.values(logosRef.current)) await k.add(s);
      k.start();
      const score = buildScore(L.filter((c) => c.standing && c.standing.length));
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const wav = await renderWav(score);
      const buf = await ctx.decodeAudioData(await wav.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      const stream = new MediaStream([...big.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      await new Promise<void>((resolve) => {
        rec.onstop = () => {
          k.stop();
          ctx.close();
          download(new Blob(chunks, { type: "video/webm" }), "kaleidoscope.webm");
          resolve();
        };
        rec.start();
        src.start();
        setTimeout(() => rec.stop(), Math.min(30, buf.duration) * 1000);
      });
    } finally {
      setRecording(false);
    }
  };
  return (
    <>
      <header>
        <h2>הצורות</h2>
        <p>כל צילום אריחים מהיער הופך אוטומטית לצורה גאומטרית: משולשים בשלושת הצבעים, בלי הרצפה ובלי הצללים.</p>
      </header>
      <section className="card row">
        <div>
          <h3>הקליידוסקופ</h3>
          <canvas ref={canvas} id="kp" width={640} height={360} className="kcan" />
        </div>
        <div>
          <h3>הורדות</h3>
          <div className="btns col">
            <button type="button" className="sbtn" disabled={!Object.keys(logos).length} onClick={() => L.forEach((c, i) => setTimeout(() => logos[c.circle] && download(new Blob([logos[c.circle]], { type: "image/svg+xml" }), `circle-${c.circle}.svg`), i * 150))}>
              הורדת כל הצורות (SVG)
            </button>
            <button type="button" className="sbtn ghost" disabled={recording || !L.length} onClick={() => void record()}>
              {recording ? "מקליטה... 30 שניות" : "הקלטת סרטון קליידוסקופ + מנגינה (30 שנ׳)"}
            </button>
          </div>
          <p className="hint">מעגל בלי צילום מקבל צורה שנבנית מהגרף שלו, כדי שאף מעגל לא יחסר.</p>
        </div>
      </section>
      <section className="card">
        <h3>לפני ואחרי</h3>
        <div className="sgrid" id="sg">
          {L.length ? (
            L.map((c) => (
              <div className="shape" key={c.circle}>
                <b>מעגל {c.circle}</b>
                <div className="ba">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.hasPhoto && slug ? <img src={photoPath(slug, c.circle, c.photoAt)} alt="צילום" /> : <span className="ph">אין צילום</span>}
                  <span className="arr">←</span>
                  {logos[c.circle] ? <Html html={logos[c.circle]} className="lg" /> : <span className="lg">...</span>}
                </div>
              </div>
            ))
          ) : (
            <p className="hint">עוד אין צילומים.</p>
          )}
        </div>
      </section>
    </>
  );
}

// ---------- החשיפה ----------
function RevealTab({ view, active, act, content }: { view: StudioView; active: EventInfo | null; act: Act; content: ReturnType<typeof buildContent> }) {
  const L = creationsOf(view);
  const N = active?.circles ?? 30;
  const REVEAL = content.REVEAL;
  const ready = { melody: L.filter((c) => c.standing && c.standing.length >= 5).length, song: L.filter((c) => c.sentence).length, shape: L.filter((c) => c.hasPhoto).length };
  return (
    <>
      <header>
        <h2>החשיפה</h2>
        <p>
          {REVEAL.pre} {REVEAL.pre2}
        </p>
      </header>
      <div className="kpis">
        <div>
          <b>
            {ready.melody}/{N}
          </b>
          <span>מנגינות</span>
        </div>
        <div>
          <b>
            {ready.song}/{N}
          </b>
          <span>שורות לשיר</span>
        </div>
        <div>
          <b>
            {ready.shape}/{N}
          </b>
          <span>צילומים</span>
        </div>
      </div>
      <section className="card">
        <h3>על המסך הגדול</h3>
        <p className="hint">לוחצים כאן, ועל מסך האולם מופיע פתיח עם כפתור ״{content.HALL.revealCta}״ (לוחצים עליו במחשב שמחובר למקרן, כדי שהסאונד יתנגן משם).</p>
        <div className="btns">
          <button type="button" className="sbtn gold" disabled={!active} data-testid="studio-reveal-on" onClick={() => active && void act({ action: "control", slug: active.slug, reveal: true })}>
            <Html html={icon("star", 30, "#fff")} />
            הצגת החשיפה במסך האולם
          </button>
          <button type="button" className="sbtn ghost" disabled={!active} data-testid="studio-reveal-off" onClick={() => active && void act({ action: "control", slug: active.slug, reveal: false })}>
            חזרה למסך החי
          </button>
        </div>
        <p className="hint" data-testid="studio-reveal-state">
          {active?.reveal ? "● החשיפה מוצגת עכשיו" : "○ המסך החי מוצג עכשיו"}
        </p>
      </section>
      <section className="card">
        <h3>הסדר על הבמה</h3>
        <ol className="runsheet">
          <li>שרה עולה לבמה: ״{REVEAL.pre}״</li>
          <li>״{REVEAL.pre2}״ ← לוחצים על החשיפה</li>
          <li>המנגינה של האולם מתנגנת. בכל מעגל: המספר שלו, השורה שלו והצורה שלו נכנסת לקליידוסקופ</li>
          <li>בסוף: ״{REVEAL.close}״</li>
          <li>הזמרת: מנסה לשיר את השיר שה-AI הפיק מהמילים של האולם (מ-Suno)</li>
        </ol>
      </section>
      <p className="hint">
        {ZONE_IDS.map((z: ZoneId) => (
          <Html key={z} html={tokenArt(z, 22)} />
        ))}{" "}
        {view.hall.circles.length} מעגלים באולם
      </p>
    </>
  );
}
