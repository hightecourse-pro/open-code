import "server-only";
// ============================================================================
// המסע לאי השפיות · the server side: events, the circles' saved games, the
// creations, the photos. Service-role only; the API routes under
// /api/sanity are the door, and every page reads through here.
// ============================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import type { Gender } from "./content";
import type { GameState, Snapshot } from "./engine";
import { HALL_SCENES, SLUG_RE, TOKEN_RE, type CreationMeta, type EventInfo, type HallScene, type HallView, type StudioView, type TabletBootstrap, type TabletSave, type TabletSaveResult } from "./shared";

type EventRow = Database["public"]["Tables"]["sanity_events"]["Row"];
type CircleRow = Database["public"]["Tables"]["sanity_circles"]["Row"];
type CreationRow = Database["public"]["Tables"]["sanity_creations"]["Row"];

const BUCKET = "sanity";
/** The forest photo arrives as a JPEG data URL; the tablet shrinks it to 640px (~60KB). Anything bigger is refused. */
const MAX_PHOTO_BYTES = 400_000;
export const FONT_FILES = ["RagSans-Light.ttf", "RagSans-Regular.ttf", "RagSans-Medium.ttf", "RagSans-Bold.ttf"] as const;

export class SanityError extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}
const fail = (msg: string, status = 400): never => {
  throw new SanityError(msg, status);
};

const admin = () => createAdminClient();
const asJson = (v: unknown): Json => v as Json;

function eventInfo(r: EventRow): EventInfo {
  const cmp = Array.isArray(r.compare) && r.compare.length === 2 ? ([Number(r.compare[0]), Number(r.compare[1])] as [number, number]) : null;
  return {
    slug: r.slug,
    name: r.name,
    circles: r.circles,
    gender: r.gender,
    active: r.active,
    startedAt: r.started_at,
    resetAt: r.reset_at,
    hallScene: r.hall_scene,
    focusCircle: r.focus_circle,
    compare: cmp,
    reveal: r.reveal,
    createdAt: r.created_at,
  };
}
function creationMeta(r: CreationRow): CreationMeta {
  return {
    circle: r.circle,
    standing: Array.isArray(r.standing) ? (r.standing as number[]).map(Number) : [],
    sentence: r.sentence,
    quad: r.quad && typeof r.quad === "object" && !Array.isArray(r.quad) ? (r.quad as Record<string, number>) : null,
    hasPhoto: !!r.photo_path,
    photoAt: r.photo_at,
  };
}

// ---------- events ----------
export async function listEvents(): Promise<EventInfo[]> {
  const { data, error } = await admin().from("sanity_events").select("*").order("created_at", { ascending: false });
  if (error) fail(error.message, 500);
  return (data ?? []).map(eventInfo);
}
async function eventRow(slug: string): Promise<EventRow> {
  const { data } = await admin().from("sanity_events").select("*").eq("slug", slug).maybeSingle();
  if (!data) fail("האירוע לא נמצא", 404);
  return data!;
}
async function activeRow(): Promise<EventRow | null> {
  const { data } = await admin().from("sanity_events").select("*").eq("active", true).maybeSingle();
  return data ?? null;
}
export async function activeEvent(): Promise<EventInfo | null> {
  const r = await activeRow();
  return r ? eventInfo(r) : null;
}

export async function createEvent(input: { slug: string; name: string; circles?: number; gender?: Gender }): Promise<EventInfo> {
  const slug = String(input.slug ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const circles = Math.max(1, Math.min(60, Math.round(Number(input.circles ?? 30)) || 30));
  const gender: Gender = input.gender === "f" ? "f" : "m";
  if (!SLUG_RE.test(slug)) fail("מזהה האירוע: אותיות לטיניות קטנות, ספרות ומקפים, 2 עד 40 תווים");
  if (name.length < 2) fail("לאירוע צריך שם");
  const db = admin();
  const { data: exists } = await db.from("sanity_events").select("id").eq("slug", slug).maybeSingle();
  if (exists) fail("כבר יש אירוע עם המזהה הזה");
  const active = !(await activeRow());
  const { data, error } = await db.from("sanity_events").insert({ slug, name, circles, gender, active }).select("*").single();
  if (error || !data) fail(error?.message ?? "insert failed", 500);
  const rows = [...Array(circles)].map((_, i) => ({ event_id: data!.id, circle: i + 1 }));
  const { error: e2 } = await db.from("sanity_circles").insert(rows);
  if (e2) fail(e2.message, 500);
  return eventInfo(data!);
}

export async function updateEvent(slug: string, patch: { name?: string; gender?: Gender; circles?: number }): Promise<EventInfo> {
  const r = await eventRow(slug);
  const db = admin();
  const upd: Database["public"]["Tables"]["sanity_events"]["Update"] = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (name.length < 2) fail("לאירוע צריך שם");
    upd.name = name;
  }
  if (patch.gender !== undefined) upd.gender = patch.gender === "f" ? "f" : "m";
  if (patch.circles !== undefined) {
    const n = Math.max(1, Math.min(60, Math.round(Number(patch.circles)) || r.circles));
    if (n < r.circles) {
      const { count } = await db.from("sanity_circles").select("circle", { count: "exact", head: true }).eq("event_id", r.id).gt("circle", n).not("state", "is", null);
      if (count) fail(`יש כבר משחק במעגל מעל ${n}; מאפסים אותו קודם`);
      await db.from("sanity_circles").delete().eq("event_id", r.id).gt("circle", n);
      await db.from("sanity_creations").delete().eq("event_id", r.id).gt("circle", n);
    } else if (n > r.circles) {
      const rows = [...Array(n - r.circles)].map((_, i) => ({ event_id: r.id, circle: r.circles + i + 1 }));
      const { error } = await db.from("sanity_circles").insert(rows);
      if (error) fail(error.message, 500);
    }
    upd.circles = n;
  }
  const { data, error } = await db.from("sanity_events").update(upd).eq("id", r.id).select("*").single();
  if (error || !data) fail(error?.message ?? "update failed", 500);
  return eventInfo(data!);
}

export async function activateEvent(slug: string): Promise<EventInfo> {
  const r = await eventRow(slug);
  const db = admin();
  await db.from("sanity_events").update({ active: false }).eq("active", true);
  const { data, error } = await db.from("sanity_events").update({ active: true, updated_at: new Date().toISOString() }).eq("id", r.id).select("*").single();
  if (error || !data) fail(error?.message ?? "activate failed", 500);
  return eventInfo(data!);
}

export async function deleteEvent(slug: string): Promise<void> {
  const r = await eventRow(slug);
  if (r.active) fail("אי אפשר למחוק את האירוע הפעיל; מפעילים אירוע אחר קודם");
  await removePhotos(r);
  const { error } = await admin().from("sanity_events").delete().eq("id", r.id);
  if (error) fail(error.message, 500);
}

/** ״התחלת האירוע״: the hall's clock starts now. */
export async function startEvent(slug: string): Promise<EventInfo> {
  const r = await eventRow(slug);
  const { data, error } = await admin().from("sanity_events").update({ started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id).select("*").single();
  if (error || !data) fail(error?.message ?? "start failed", 500);
  return eventInfo(data!);
}

async function removePhotos(r: EventRow, circle?: number) {
  const db = admin();
  let q = db.from("sanity_creations").select("photo_path").eq("event_id", r.id).not("photo_path", "is", null);
  if (circle) q = q.eq("circle", circle);
  const { data } = await q;
  const paths = (data ?? []).map((x) => x.photo_path!).filter(Boolean);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
}

/** ״איפוס האירוע״: every circle starts from nothing, the creations and photos go, the clock and the hall controls reset. The tablets drop their local games (reset_at). */
export async function resetEvent(slug: string): Promise<EventInfo> {
  const r = await eventRow(slug);
  const db = admin();
  const now = new Date().toISOString();
  await removePhotos(r);
  await db.from("sanity_creations").delete().eq("event_id", r.id);
  await db.from("sanity_circles").update({ state: null, snapshot: null, version: 0, stage: 0, finished: false, history: [], reset_at: now, updated_at: now }).eq("event_id", r.id);
  const { data, error } = await db
    .from("sanity_events")
    .update({ started_at: null, reset_at: now, hall_scene: "auto", focus_circle: null, compare: null, reveal: false, updated_at: now })
    .eq("id", r.id)
    .select("*")
    .single();
  if (error || !data) fail(error?.message ?? "reset failed", 500);
  return eventInfo(data!);
}

/** One circle starts over (a tablet that must begin again, a test circle). */
export async function resetCircle(slug: string, circle: number): Promise<void> {
  const r = await eventRow(slug);
  const db = admin();
  const now = new Date().toISOString();
  await removePhotos(r, circle);
  await db.from("sanity_creations").delete().eq("event_id", r.id).eq("circle", circle);
  const { error } = await db.from("sanity_circles").update({ state: null, snapshot: null, version: 0, stage: 0, finished: false, history: [], reset_at: now, updated_at: now }).eq("event_id", r.id).eq("circle", circle);
  if (error) fail(error.message, 500);
}

/**
 * ״מסך אחורה״ (the owner, 25.11: ״שבקונטרול יוכלו להחזיר פעולה אחת אחורה״ … ״ואני בוחר לאיפה להחזיר אותו״): the circle
 * goes back to the beginning of an earlier screen - by default the one before the current, or `to` (an index into
 * its history). A task gets its whole time again. The version jumps by 10, not 1, so the tablet's own next save
 * comes out stale and it adopts the restored game (its poll catches it within ten seconds anyway).
 */
export async function undoCircle(slug: string, circle: number, to?: number): Promise<void> {
  const r = await eventRow(slug);
  const db = admin();
  const { data: row } = await db.from("sanity_circles").select("version,history").eq("event_id", r.id).eq("circle", circle).maybeSingle();
  if (!row) fail("אין מעגל כזה", 404);
  const hist = Array.isArray(row!.history) ? (row!.history as unknown as HistoryStep[]) : [];
  const idx = to == null ? hist.length - 2 : Math.round(Number(to));
  const step = idx >= 0 && idx <= hist.length - 2 ? hist[idx] : null;
  if (!step || !step.state || !step.snapshot) fail("אין מסך אחורה למעגל הזה", 400);
  const state: GameState = { ...step!.state };
  if (state.phase === "task" && state.timer && typeof state.timer.total === "number") state.timer = { end: Date.now() + state.timer.total * 1000, total: state.timer.total };
  const now = new Date().toISOString();
  const snap: Snapshot = { ...step!.snapshot, circle, t: Date.now() };
  const { error } = await db
    .from("sanity_circles")
    .update({ state: asJson(state), snapshot: asJson(snap), version: row!.version + 10, stage: Math.round(Number(snap.stage) || 0), finished: !!snap.finished, history: asJson(hist.slice(0, idx + 1)), updated_at: now })
    .eq("event_id", r.id)
    .eq("circle", circle);
  if (error) fail(error.message, 500);
}

/** The owner's wording edits (the game's edit mode, 26.11): read by Claude, never by the game. */
export type TextEditRow = { key: string; kind: "text" | "screen" | "note"; original: string | null; text: string | null; screen: string | null; updated_at: string };
export async function listTextEdits(): Promise<TextEditRow[]> {
  const { data, error } = await admin().from("sanity_text_edits").select("*").order("updated_at", { ascending: false }).limit(2000);
  if (error) fail(error.message, 500);
  return (data ?? []) as TextEditRow[];
}
export async function putTextEdit(e: { kind: "text" | "screen" | "note"; key: string; text: string | null; original: string | null; screen: string | null }): Promise<void> {
  const db = admin();
  if (e.text == null) {
    const { error } = await db.from("sanity_text_edits").delete().eq("key", e.key);
    if (error) fail(error.message, 500);
    return;
  }
  const { error } = await db.from("sanity_text_edits").upsert({ key: e.key, kind: e.kind, text: e.text, original: e.original, screen: e.screen, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) fail(error.message, 500);
}

/** The studio's remote for the hall screen. */
export async function setControl(slug: string, c: { hallScene?: string; focusCircle?: number | null; compare?: [number, number] | null; reveal?: boolean }): Promise<EventInfo> {
  const r = await eventRow(slug);
  const upd: Database["public"]["Tables"]["sanity_events"]["Update"] = { updated_at: new Date().toISOString() };
  if (c.hallScene !== undefined) {
    if (!(HALL_SCENES as readonly string[]).includes(c.hallScene)) fail("סצנה לא מוכרת");
    upd.hall_scene = c.hallScene as HallScene;
  }
  if (c.focusCircle !== undefined) upd.focus_circle = c.focusCircle ? Math.round(Number(c.focusCircle)) : null;
  if (c.compare !== undefined) upd.compare = c.compare && c.compare.length === 2 ? asJson([Math.round(Number(c.compare[0])), Math.round(Number(c.compare[1]))]) : null;
  if (c.reveal !== undefined) upd.reveal = !!c.reveal;
  const { data, error } = await admin().from("sanity_events").update(upd).eq("id", r.id).select("*").single();
  if (error || !data) fail(error?.message ?? "control failed", 500);
  return eventInfo(data!);
}

// ---------- the tablet ----------
async function circleByToken(token: string): Promise<{ circle: CircleRow; event: EventRow }> {
  if (!TOKEN_RE.test(token)) fail("הכתובת הזאת לא שייכת לאף מעגל", 404);
  const db = admin();
  const { data: c } = await db.from("sanity_circles").select("*").eq("token", token).maybeSingle();
  if (!c) fail("הכתובת הזאת לא שייכת לאף מעגל", 404);
  const { data: e } = await db.from("sanity_events").select("*").eq("id", c!.event_id).maybeSingle();
  if (!e) fail("האירוע של המעגל נמחק", 404);
  return { circle: c!, event: e! };
}

export async function tabletBootstrap(token: string): Promise<TabletBootstrap> {
  const { circle, event } = await circleByToken(token);
  const { data: cr } = await admin().from("sanity_creations").select("photo_path").eq("event_id", event.id).eq("circle", circle.circle).maybeSingle();
  return {
    event: { slug: event.slug, name: event.name, gender: event.gender, circles: event.circles },
    circle: circle.circle,
    state: (circle.state as unknown as GameState | null) ?? null,
    version: circle.version,
    resetAt: circle.reset_at,
    hasPhoto: !!cr?.photo_path,
    now: Date.now(),
  };
}

/** One entry of a circle's ״מסך אחורה״ list: the game as the screen opened. */
type HistoryStep = { state: GameState; snapshot: Snapshot; t: number };

function stripState(s: GameState): GameState {
  // the photo lives in storage, never in the saved game
  return { ...s, creations: { ...s.creations, photo: null } };
}

/**
 * A tablet saved its game. The version is the tablet's monotonic counter: a
 * write behind the stored one means another device took the circle over,
 * and the tablet gets the server's game back instead.
 */
export async function saveTablet(token: string, body: TabletSave): Promise<TabletSaveResult> {
  const { circle, event } = await circleByToken(token);
  const version = Math.round(Number(body.version));
  if (!Number.isFinite(version) || !body.state || typeof body.state !== "object" || !body.snapshot) return { ok: false, error: "חסר מצב משחק" };
  if (body.state.circle !== circle.circle) return { ok: false, error: "המשחק הזה שייך למעגל אחר" };
  if (version < circle.version) return { ok: false, stale: true, state: (circle.state as unknown as GameState | null) ?? null, version: circle.version, resetAt: circle.reset_at };
  // a game born before the last reset of this circle is the old game - refuse it, the tablet starts over
  if (circle.reset_at && body.state.createdAt && body.state.createdAt < new Date(circle.reset_at).getTime()) {
    return { ok: false, stale: true, state: null, version: 0, resetAt: circle.reset_at };
  }
  const db = admin();
  const now = new Date().toISOString();
  const snap: Snapshot = { ...body.snapshot, circle: circle.circle, t: Date.now() };
  // ״מסך אחורה״ (the owner, 25.11): the game as it is at the BEGINNING of every screen (the first save of a new phase),
  // the last 60 kept (a whole game is ~50 screens, ~2KB each). Not the end of the previous screen: that already holds the choice made there, and a circle sent
  // back to it would sail off to the same island again (the owner's first test).
  const prevSnap = circle.snapshot as unknown as Snapshot | null;
  const kept = Array.isArray(circle.history) ? (circle.history as unknown as HistoryStep[]) : [];
  const hist = !prevSnap || prevSnap.phase !== snap.phase ? [...kept, { state: stripState(body.state), snapshot: snap, t: Date.now() }].slice(-60) : kept;
  const { error } = await db
    .from("sanity_circles")
    .update({ version, state: asJson(stripState(body.state)), snapshot: asJson(snap), stage: Math.round(Number(snap.stage) || 0), finished: !!snap.finished, history: asJson(hist), updated_at: now })
    .eq("event_id", event.id)
    .eq("circle", circle.circle);
  if (error) return { ok: false, error: error.message };
  if (body.creations || body.photo) {
    const upd: Database["public"]["Tables"]["sanity_creations"]["Insert"] = { event_id: event.id, circle: circle.circle, updated_at: now };
    if (body.creations) {
      upd.standing = asJson((body.creations.standing ?? []).map((n) => Math.max(0, Math.min(12, Math.round(Number(n)) || 0))));
      upd.sentence = String(body.creations.sentence ?? "").slice(0, 80);
      upd.quad = body.creations.quad ? asJson(body.creations.quad) : null;
    }
    if (body.photo) {
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.photo);
      if (!m) return { ok: false, error: "הצילום לא בפורמט JPEG" };
      const bytes = Buffer.from(m[1], "base64");
      if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: "הצילום גדול מדי" };
      const path = `${event.slug}/${circle.circle}.jpg`;
      const { error: e2 } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (e2) return { ok: false, error: e2.message };
      upd.photo_path = path;
      upd.photo_at = now;
    }
    const { error: e3 } = await db.from("sanity_creations").upsert(upd, { onConflict: "event_id,circle" });
    if (e3) return { ok: false, error: e3.message };
  }
  return { ok: true, version, now: Date.now() };
}

// ---------- the hall and the studio ----------
export async function hallView(slug?: string | null): Promise<HallView> {
  const db = admin();
  const ev = slug ? await db.from("sanity_events").select("*").eq("slug", slug).maybeSingle().then((x) => x.data) : await activeRow();
  if (!ev) return { event: null, circles: [], creations: [], now: Date.now() };
  const [{ data: cs }, { data: crs }] = await Promise.all([
    db.from("sanity_circles").select("circle,snapshot").eq("event_id", ev.id).not("snapshot", "is", null).order("circle"),
    db.from("sanity_creations").select("*").eq("event_id", ev.id).order("circle"),
  ]);
  return {
    event: eventInfo(ev),
    circles: (cs ?? []).map((c) => c.snapshot as unknown as Snapshot).filter((s) => s && typeof s === "object"),
    creations: (crs ?? []).map(creationMeta),
    now: Date.now(),
  };
}

export async function studioView(): Promise<StudioView> {
  const events = await listEvents();
  const active = events.find((e) => e.active) ?? null;
  const hall = await hallView(active?.slug);
  let tokens: StudioView["tokens"] = [];
  if (active) {
    const { data: ev } = await admin().from("sanity_events").select("id").eq("slug", active.slug).maybeSingle();
    const { data } = ev ? await admin().from("sanity_circles").select("circle,token,history").eq("event_id", ev.id).order("circle") : { data: [] };
    tokens = (data ?? []).map((r) => {
      const hist = Array.isArray(r.history) ? (r.history as unknown as HistoryStep[]) : [];
      return { circle: r.circle, token: r.token, undo: Math.max(0, hist.length - 1), steps: hist.map((h) => ({ phase: String(h.snapshot?.phase ?? ""), zone: (h.snapshot?.zone as string | undefined) ?? null, t: Number(h.t) || 0 })) };
    });
  }
  return { events, active: active?.slug ?? null, hall, tokens, sunoConfigured: !!(process.env.SUNO_API_KEY && process.env.SUNO_BASE), now: Date.now() };
}

/** The studio's simulation (30 virtual circles): snapshots and creations written straight in, no tablets. */
export async function simWrite(slug: string, rows: { circle: number; snapshot: Snapshot; creations?: { standing: number[]; sentence: string; photo?: string | null } }[]): Promise<number> {
  const r = await eventRow(slug);
  const db = admin();
  const now = new Date().toISOString();
  let n = 0;
  // the snapshots in one round trip (a tick of 30 circles was 30 updates - six seconds from the studio's browser)
  const snaps = rows
    .slice(0, 60)
    .filter((row) => row.snapshot && Math.round(Number(row.circle)) >= 1 && Math.round(Number(row.circle)) <= r.circles)
    .map((row) => {
      const circle = Math.round(Number(row.circle));
      const snap: Snapshot = { ...row.snapshot, circle, t: Date.now() };
      return { event_id: r.id, circle, snapshot: asJson(snap), stage: Math.round(Number(snap.stage) || 0), finished: !!snap.finished, updated_at: now };
    });
  if (snaps.length) {
    const { error } = await db.from("sanity_circles").upsert(snaps, { onConflict: "event_id,circle" });
    if (error) fail(error.message, 500);
  }
  for (const row of rows.slice(0, 60)) {
    const circle = Math.round(Number(row.circle));
    if (!(circle >= 1 && circle <= r.circles) || !row.snapshot) continue;
    if (row.creations) {
      const upd: Database["public"]["Tables"]["sanity_creations"]["Insert"] = { event_id: r.id, circle, standing: asJson(row.creations.standing ?? []), sentence: String(row.creations.sentence ?? "").slice(0, 80), updated_at: now };
      if (row.creations.photo) {
        const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(row.creations.photo);
        if (m) {
          const path = `${r.slug}/${circle}.jpg`;
          const { error: e2 } = await db.storage.from(BUCKET).upload(path, Buffer.from(m[1], "base64"), { contentType: "image/jpeg", upsert: true });
          if (!e2) {
            upd.photo_path = path;
            upd.photo_at = now;
          }
        }
      }
      await db.from("sanity_creations").upsert(upd, { onConflict: "event_id,circle" });
    }
    n++;
  }
  return n;
}

// ---------- files streamed through our own domain (Netfree) ----------
export async function photoObject(slug: string, circle: number): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (!SLUG_RE.test(slug) || !(circle >= 1 && circle <= 60)) return null;
  const db = admin();
  const { data: ev } = await db.from("sanity_events").select("id").eq("slug", slug).maybeSingle();
  if (!ev) return null;
  const { data: cr } = await db.from("sanity_creations").select("photo_path").eq("event_id", ev.id).eq("circle", circle).maybeSingle();
  if (!cr?.photo_path) return null;
  const { data, error } = await db.storage.from(BUCKET).download(cr.photo_path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), contentType: "image/jpeg" };
}

export async function fontObject(file: string): Promise<ArrayBuffer | null> {
  if (!(FONT_FILES as readonly string[]).includes(file)) return null;
  const { data, error } = await admin().storage.from(BUCKET).download(`fonts/${file}`);
  if (error || !data) return null;
  return data.arrayBuffer();
}

/** The team puts the font files in place through the app itself (tools/sanity-fonts-upload.mjs): the server holds the storage key, nobody else needs it. */
export async function putFont(file: string, bytes: Buffer): Promise<void> {
  if (!(FONT_FILES as readonly string[]).includes(file)) fail("לא קובץ פונט של המשחק", 404);
  if (bytes.length < 10_000 || bytes.length > 400_000) fail("גודל הקובץ לא סביר לפונט");
  const { error } = await admin().storage.from(BUCKET).upload(`fonts/${file}`, bytes, { contentType: "font/ttf", upsert: true });
  if (error) fail(error.message, 500);
}
