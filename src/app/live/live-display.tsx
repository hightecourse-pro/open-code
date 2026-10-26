"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDisplayView, LiveFinalsView } from "@/lib/hackathon-live-shared";

const POLL_MS = 2000;

const CSS = `
.lv{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden;font-family:var(--font-noto-hebrew),"Noto Sans Hebrew",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --pink:#e0418d;--pink-deep:#ce2462;--magenta:#913f80;--purple:#6b3d99;--indigo:#464ca0;
  --grad:linear-gradient(95deg,#e0418d 0%,#913f80 50%,#464ca0 100%);--celebrate:linear-gradient(120deg,#ffd166 0%,#e0418d 33%,#913f80 66%,#464ca0 100%);
  --page:#f8f8fb;--surface:#fff;--surface2:#f1f1f7;--line:#e2e2ec;--txt:#11102a;--txt2:#3a3a5c;--muted:#6e6e8a;--track:#eceef8;--tint-pink:#fdecf3;--dot:#c4c4d2;
  --success:#1f9d6a;--success-bg:#e8f6ef;--danger:#d8345f;--shadow:0 8px 20px #2e2e6e1a,0 2px 4px #2e2e6e0d;
  background:var(--page);color:var(--txt);cursor:none}
.lv[data-theme="dark"]{--page:#11102a;--surface:#1f1e3f;--surface2:#2a2950;--line:#3a3a5c;--txt:#fff;--txt2:#d8d8e6;--muted:#9a9ab1;--track:#2a2950;--tint-pink:#3d1d33;--dot:#4a4a70;--success-bg:#163b2c;--shadow:0 8px 24px #00000055}
.lv.cursor{cursor:default}
.lv::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 60% at 50% 40%,#e0418d33 0%,#464ca000 70%);pointer-events:none}
.lv>*{position:relative}
.stripe{height:6px;background:var(--celebrate);flex:none}
.hd{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(8px,1.4vh,18px) clamp(16px,3vw,48px);background:var(--surface);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:18px;min-width:0}
.brand .ev{height:clamp(44px,8vh,96px);width:auto;display:block}
.lv[data-theme="dark"] .brand .ev{background:#fff;border-radius:14px;padding:4px 10px}
.brand .oc{height:clamp(30px,5vh,64px);width:auto;display:block}
.lv[data-theme="dark"] .brand .oc{display:none}
.brand .name{font-size:clamp(16px,2.2vw,30px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-inline-start:16px;border-inline-start:2px solid var(--line)}
.phone{display:flex;align-items:center;gap:14px;white-space:nowrap;background:var(--surface2);border:1px solid var(--line);border-radius:9999px;padding:6px 22px}
.phone .l{font-size:clamp(13px,1.4vw,20px);color:var(--txt2);font-weight:600}
.phone .n{font-size:clamp(22px,3vw,46px);font-weight:900;letter-spacing:.03em;direction:ltr;font-variant-numeric:tabular-nums;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.mn{flex:1;display:flex;flex-direction:column;padding:clamp(12px,2.2vh,32px) clamp(18px,4vw,72px);min-height:0}
.idle{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:clamp(10px,2vh,28px)}
.idle .logo{height:clamp(80px,18vh,220px);width:auto}
.lv[data-theme="dark"] .idle .logo{background:#fff;border-radius:22px;padding:10px 20px}
.idle .big{font-size:clamp(28px,5vw,80px);font-weight:900}
.idle .num{font-size:clamp(40px,9vw,160px);font-weight:900;letter-spacing:.04em;direction:ltr;line-height:1;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.idle .sub{font-size:clamp(16px,2.4vw,34px);color:var(--txt2);font-weight:500}
.q{font-size:clamp(26px,4.6vw,78px);font-weight:800;line-height:1.18;margin:0 0 clamp(12px,2.4vh,32px);letter-spacing:-.01em;max-height:34vh;overflow:hidden}
.q.long{font-size:clamp(22px,3.4vw,56px)} .q.xlong{font-size:clamp(18px,2.6vw,42px)}
.bars{flex:1;display:flex;flex-direction:column;justify-content:center;gap:clamp(8px,1.6vh,22px);min-height:0}
.row{display:grid;grid-template-columns:auto minmax(120px,.34fr) 1fr auto;align-items:center;gap:clamp(10px,1.4vw,22px);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:clamp(6px,1.2vh,14px) clamp(12px,1.6vw,24px);box-shadow:var(--shadow)}
.key{width:clamp(36px,4.4vh,68px);height:clamp(36px,4.4vh,68px);border-radius:14px;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:900;font-size:clamp(18px,2.6vh,36px);box-shadow:0 6px 16px #e0418d40}
.lab{font-size:clamp(18px,2.6vh,40px);font-weight:700;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lead{display:inline-block;margin-inline-start:10px;font-size:.5em;font-weight:700;color:var(--purple);background:#f2ebf7;border-radius:9999px;padding:2px 12px;vertical-align:middle}
.lv[data-theme="dark"] .lead{background:#3a3a5c;color:#fff}
.track{position:relative;height:clamp(22px,4.2vh,60px);background:var(--track);border-radius:9999px;overflow:hidden}
.fill{position:absolute;inset:0 0 0 auto;width:0;height:100%;background:var(--grad);border-radius:9999px;transition:width .6s cubic-bezier(.22,1,.36,1)}
.fill.nz{min-width:clamp(22px,4.2vh,60px)}
.val{font-size:clamp(18px,2.8vh,42px);font-weight:800;min-width:5.5ch;text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
.val small{font-size:.6em;font-weight:600;color:var(--txt2);margin-inline-start:6px}
.mn.hid{justify-content:center}
.mn.hid .q{text-align:center;max-height:38vh;margin-bottom:clamp(20px,4vh,56px)}
.tiles{flex:0 0 auto;display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(12px,2vw,32px)}
.tile{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:clamp(8px,1.6vh,20px);flex:0 1 calc((100% - (var(--cols) - 1) * clamp(12px,2vw,32px)) / var(--cols));min-width:160px;min-height:clamp(120px,26vh,340px);padding:clamp(14px,2.4vh,30px) clamp(12px,1.6vw,26px);border-radius:28px;position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow)}
.tile::before{content:"";position:absolute;inset:0 0 auto 0;height:8px;background:var(--grad)}
.tile .key{width:clamp(56px,9vh,120px);height:clamp(56px,9vh,120px);border-radius:28px;font-size:clamp(28px,5vh,64px)}
.tile .lab{font-size:clamp(20px,3.2vh,46px);-webkit-line-clamp:3}
.ft{display:flex;align-items:stretch;gap:clamp(10px,1.6vw,24px);padding:clamp(10px,1.6vh,22px) clamp(16px,3vw,48px);border-top:1px solid var(--line);background:var(--surface)}
.st{flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:20px;padding:clamp(8px,1.4vh,18px) clamp(12px,1.6vw,24px);display:flex;flex-direction:column;justify-content:center;min-width:0}
.st .l{font-size:clamp(12px,1.5vh,20px);color:var(--txt2);white-space:nowrap;font-weight:600}
.st .v{font-size:clamp(26px,4.6vh,64px);font-weight:900;line-height:1.1;white-space:nowrap}
.st .v small{font-size:.48em;font-weight:600;color:var(--txt2)}
.st.pillbox{flex:0 0 auto;align-items:center;justify-content:center;min-width:clamp(140px,16vw,260px)}
.pill{display:inline-flex;align-items:center;gap:10px;border-radius:9999px;padding:6px 20px;font-size:clamp(14px,2.2vh,28px);font-weight:800;background:var(--surface);border:1.5px solid var(--line);color:var(--txt2)}
.pill i{width:.7em;height:.7em;border-radius:50%;background:var(--muted)}
.pill.open{color:var(--success);border-color:var(--success);background:var(--success-bg)} .pill.open i{background:var(--success);animation:lvpulse 1.6s infinite}
.pill.closed{color:var(--pink-deep);border-color:var(--pink);background:var(--tint-pink)} .pill.closed i{background:var(--pink)}
.lv[data-theme="dark"] .pill.closed{color:#ff8ac0}
@keyframes lvpulse{0%{box-shadow:0 0 0 0 #1f9d6a88}70%{box-shadow:0 0 0 .55em #1f9d6a00}100%{box-shadow:0 0 0 0 #1f9d6a00}}
.net{position:absolute;bottom:8px;left:12px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;opacity:.85}
.net i{width:9px;height:9px;border-radius:50%;background:var(--success)} .net.bad i{background:var(--danger)} .net.warn i{background:#c77800}
/* finals */
.fin{flex:1;display:flex;flex-direction:column;min-height:0;gap:clamp(8px,1.6vh,20px)}
.fh{display:flex;align-items:center;justify-content:space-between;gap:20px}
.kick{display:inline-block;font-size:clamp(12px,1.6vh,20px);font-weight:700;color:var(--pink-deep);letter-spacing:.04em;background:var(--tint-pink);border-radius:9999px;padding:2px 14px}
.lv[data-theme="dark"] .kick{color:#ff8ac0}
.fh h1{margin:4px 0 0;font-size:clamp(26px,4.2vw,64px);font-weight:900;line-height:1.1;letter-spacing:-.01em}
.logos{display:flex;gap:14px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:18px;padding:8px 16px}
.logos img{height:clamp(30px,5.5vh,72px);width:auto;max-width:200px;object-fit:contain}
.fg{flex:1;display:flex;flex-direction:column;justify-content:center;gap:clamp(6px,1.2vh,16px);min-height:0}
.fr{display:grid;grid-template-columns:auto minmax(200px,1.5fr) minmax(120px,.8fr) minmax(160px,1.1fr) auto;align-items:center;gap:clamp(10px,1.4vw,24px);background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:clamp(6px,1.2vh,14px) clamp(12px,1.6vw,26px);box-shadow:var(--shadow)}
.fr.now{outline:3px solid var(--pink);outline-offset:-3px}
.fr.first{background:linear-gradient(90deg,var(--surface),var(--tint-pink))}
.rk{width:clamp(36px,5vh,70px);height:clamp(36px,5vh,70px);border-radius:16px;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:900;font-size:clamp(18px,2.8vh,38px)}
.rk.key{background:var(--surface2);color:var(--txt2);border:1px solid var(--line);box-shadow:none}
.fn b{display:-webkit-box;font-size:clamp(17px,2.6vh,38px);font-weight:800;line-height:1.15;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.fn small{display:block;font-size:clamp(12px,1.6vh,20px);color:var(--txt2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fn .nowtag{display:inline-block;margin-top:4px;font-size:clamp(11px,1.4vh,16px);font-weight:800;color:#fff;background:var(--pink);border-radius:9999px;padding:1px 10px}
.fc .l{display:block;font-size:clamp(11px,1.4vh,16px);color:var(--txt2);font-weight:600;white-space:nowrap}
.fc .v{display:block;font-size:clamp(16px,2.4vh,32px);font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.fc .v small{font-size:.6em;color:var(--txt2);font-weight:600}
.dots{display:inline-flex;gap:4px;vertical-align:middle;margin-inline-start:6px}
.dots i{width:clamp(8px,1.2vh,14px);height:clamp(8px,1.2vh,14px);border-radius:50%;background:var(--dot);display:inline-block}
.dots i.on{background:var(--success)}
.fa .track{height:clamp(14px,2.2vh,28px);margin-top:4px}
.tot{min-width:clamp(90px,10vw,170px);text-align:center}
.tot b{display:block;font-size:clamp(24px,4.4vh,60px);font-weight:900;line-height:1;font-variant-numeric:tabular-nums;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.tot b.lock{background:none;color:var(--dot);-webkit-text-fill-color:var(--dot);font-size:clamp(20px,3.4vh,40px)}
.tot span{display:block;font-size:clamp(11px,1.4vh,16px);color:var(--txt2);font-weight:600}
.leg{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:clamp(12px,1.7vh,20px);color:var(--txt2);font-weight:600}
.leg b{color:var(--txt)}
`;

const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("he-IL");

function FinalsBoard({ f, phone }: { f: LiveFinalsView; phone: string }) {
  const rows = f.finalists ?? [];
  const max = Math.max(1, ...rows.map((x) => x.audience.count || 0));
  return (
    <section className="fin">
      <div className="fh">
        <div>
          <span className="kick">גמר ההאקתון · שיפוט חי</span>
          <h1>{f.name}</h1>
        </div>
        {f.logos?.length ? (
          <div className="logos">
            {f.logos.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={l} src={l} alt="" />
            ))}
          </div>
        ) : null}
      </div>
      <div className="fg">
        {rows.map((x, i) => {
          const ranked = !f.hidden && !!x.rank;
          return (
            <div key={x.id} className={`fr${x.id === f.currentId ? " now" : ""}${ranked && x.rank === 1 ? " first" : ""}`} style={{ order: ranked ? (x.rank as number) : 100 + i }}>
              <div>
                <span className={`rk${ranked ? "" : " key"}`}>{ranked ? x.rank : x.n}</span>
              </div>
              <div className="fn">
                <b>{x.name}</b>
                {x.team ? <small>{x.team}</small> : null}
                {x.id === f.currentId ? <span className="nowtag">מציגות עכשיו</span> : null}
              </div>
              <div className="fc">
                <span className="l">
                  שופטות
                  <span className="dots">
                    {Array.from({ length: x.judgesTotal }, (_, k) => (
                      <i key={k} className={k < x.judged ? "on" : ""} />
                    ))}
                  </span>
                </span>
                <span className="v">{f.hidden ? "🔒" : x.judgesAvg === null || x.judgesAvg === undefined ? "—" : x.judgesAvg}</span>
              </div>
              <div className="fc fa">
                <span className="l">הקהל</span>
                <span className="v">
                  <b>{fmt(x.audience.count)}</b> {f.voted ? <small>· {Math.round(x.audience.pct)}%</small> : null}
                </span>
                <div className="track">
                  <div className={`fill${x.audience.count > 0 ? " nz" : ""}`} style={{ width: `${((x.audience.count / max) * 100).toFixed(1)}%` }} />
                </div>
              </div>
              <div className="tot">
                <b className={f.hidden ? "lock" : ""}>{f.hidden ? "🔒" : x.total === null || x.total === undefined ? "—" : x.total}</b>
                <span>ציון סופי</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="leg">
        <span>
          ציון סופי = <b>{f.weights?.judges}%</b> שופטות + <b>{f.weights?.audience}%</b> קהל{f.hidden ? " · התוצאות ייחשפו בסיום" : ""}
        </span>
        {phone ? (
          <span>
            להצבעת הקהל: התקשרו <b>{phone}</b> והקישו את מספר הפרויקט
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function LiveDisplay({ initial, isAdmin, forcedTheme }: { initial: LiveDisplayView; isAdmin: boolean; forcedTheme: "light" | "dark" | null }) {
  const [view, setView] = useState<LiveDisplayView>(initial);
  const [sessionTheme, setSessionTheme] = useState<"light" | "dark" | null>(null);
  const [lastOk, setLastOk] = useState<number>(() => Date.now());
  const [stale, setStale] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/hackathon/live/view", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setView((await r.json()) as LiveDisplayView);
      setLastOk(Date.now());
      setStale(false);
    } catch {
      setStale(Date.now() - lastOk > 15000);
    }
  }, [lastOk]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const control = useCallback(
    async (op: string) => {
      if (!isAdmin) return;
      try {
        const r = await fetch("/api/admin/hackathon/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "control", op }) });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!j?.ok) setToast(j?.error ?? "שגיאה");
        else refresh();
      } catch {
        setToast("אין חיבור לשרת");
      }
      setTimeout(() => setToast(null), 1800);
    },
    [isAdmin, refresh]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyF" || e.code === "F11") {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
        return;
      }
      if (e.code === "KeyT") {
        setSessionTheme((t) => ((t ?? forcedTheme ?? view.event.theme) === "dark" ? "light" : "dark"));
        return;
      }
      if (!isAdmin) return;
      const map: Record<string, string> = { PageDown: "next", ArrowLeft: "next", PageUp: "prev", ArrowRight: "prev", Space: "toggle" };
      const op = map[e.code];
      if (op) {
        e.preventDefault();
        control(op);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isAdmin, control, forcedTheme, view.event.theme]);

  const onMove = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };

  const theme = sessionTheme ?? forcedTheme ?? view.event.theme;
  const v = view;
  const q = v.question;
  const phone = v.event.phone;
  const finalsOn = !!v.finals.active;
  const hidden = !!q && !v.resultsVisible;
  const max = q ? Math.max(1, ...q.options.map((o) => o.count ?? 0)) : 1;
  const netClass = stale ? "net bad" : v.health.configured && v.health.error ? "net warn" : "net";
  const netText = stale ? "אין חיבור לשרת" : !v.health.configured ? "לא הוגדר חיבור לימות" : v.health.error ? `ימות: ${v.health.error}` : v.health.lastPollAt ? `מחובר · עודכן ${new Date(v.health.lastPollAt).toLocaleTimeString("he-IL")}` : "מחובר";

  return (
    <div className={`lv${cursor ? " cursor" : ""}`} data-theme={theme} dir="rtl" onMouseMove={onMove}>
      <style>{CSS}</style>
      <div className="stripe" />
      <header className="hd">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ev" src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="oc" src="/logo-opencode.png" alt="קוד פתוח" />
          <span className="name">{v.event.name}</span>
        </div>
        {phone ? (
          <div className="phone">
            <span className="l">התקשרו עכשיו</span>
            <span className="n">{phone}</span>
          </div>
        ) : null}
      </header>

      <main className={`mn${hidden && !finalsOn ? " hid" : ""}`}>
        {finalsOn ? (
          <FinalsBoard f={v.finals} phone={phone} />
        ) : !q ? (
          <section className="idle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/hackathon-2026/logo-hackathon.png" alt="" />
            <div className="big">כדי להצביע התקשרו עכשיו</div>
            {phone ? <div className="num">{phone}</div> : null}
            <div className="sub">ממתינים לשאלה הראשונה</div>
          </section>
        ) : (
          <>
            <h1 className={`q${q.text.length > 140 ? " xlong" : q.text.length > 70 ? " long" : ""}`}>{q.text}</h1>
            {hidden ? (
              <div className="tiles" style={{ ["--cols" as string]: q.options.length <= 4 ? q.options.length : 3 }}>
                {q.options.map((o) => (
                  <div key={o.n} className="tile">
                    <div className="key">{o.n}</div>
                    <div className="lab">{o.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bars">
                {q.options.map((o) => {
                  const count = o.count ?? 0;
                  const soleLeader = o.leading && v.voted > 0 && q.options.filter((x) => x.leading).length === 1;
                  return (
                    <div key={o.n} className="row">
                      <div className="key">{o.n}</div>
                      <div className="lab">
                        {o.label}
                        {soleLeader ? <span className="lead">מוביל</span> : null}
                      </div>
                      <div className="track">
                        <div className={`fill${count > 0 ? " nz" : ""}`} style={{ width: `${((count / max) * 100).toFixed(2)}%` }} />
                      </div>
                      <div className="val">
                        <b>{fmt(count)}</b>
                        <small>{v.voted ? `${Math.round(o.pct ?? 0)}%` : ""}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="ft">
        <div className="st pillbox">
          <span className={`pill ${q?.status === "open" ? "open" : q?.status === "closed" ? "closed" : ""}`}>
            <i />
            <span>{q?.status === "open" ? "ההצבעה פתוחה" : q?.status === "closed" ? "ההצבעה נסגרה" : "ממתינים"}</span>
          </span>
        </div>
        <div className="st">
          <span className="l">הצביעו</span>
          <span className="v">
            {fmt(v.voted)}
            {v.connected != null && v.connected > 0 ? <small> מתוך {fmt(v.connected)} · {Math.round(Math.min(100, (v.voted / v.connected) * 100))}%</small> : null}
          </span>
        </div>
        <div className="st">
          <span className="l">מחוברים עכשיו</span>
          <span className="v">{v.connected == null ? "—" : fmt(v.connected)}</span>
        </div>
      </footer>
      <div className={netClass}>
        <i />
        <span>{netText}</span>
      </div>
      {toast ? (
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "8px 16px", fontSize: 15, boxShadow: "var(--shadow)" }}>{toast}</div>
      ) : null}
    </div>
  );
}
