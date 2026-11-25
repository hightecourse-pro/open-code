import { NextResponse } from "next/server";
import { getProfile, hasHcAccess } from "@/lib/auth";
import { SanityError, activateEvent, createEvent, deleteEvent, resetCircle, resetEvent, setControl, simWrite, startEvent, studioView, undoCircle, updateEvent } from "@/lib/sanity/server";
import type { Gender } from "@/lib/sanity/content";
import type { Snapshot } from "@/lib/sanity/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Whoever may manage Hightecourse (admin or hc_access), or the team's own checks (the cron secret). */
async function allowed(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const profile = await getProfile().catch(() => null);
  return hasHcAccess(profile);
}

export async function GET(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await studioView(), { headers: { "cache-control": "no-store" } });
}

/**
 * The studio's one door. `{action, ...}`:
 *   event-create {slug, name, circles?, gender?} · event-update {slug, name?, gender?, circles?}
 *   event-activate {slug} · event-delete {slug} · start {slug} · reset {slug} · reset-circle {slug, circle} · undo-circle {slug, circle, to?}
 *   control {slug, hallScene?, focusCircle?, compare?, reveal?}
 *   sim {slug, rows: [{circle, snapshot, creations?}]}
 * Every answer carries the fresh studio view.
 */
export async function POST(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const slug = String(body.slug ?? "");
  const extra: Record<string, unknown> = {};
  try {
    switch (action) {
      case "event-create":
        extra.event = await createEvent({ slug: String(body.slug ?? ""), name: String(body.name ?? ""), circles: body.circles as number | undefined, gender: body.gender as Gender | undefined });
        break;
      case "event-update":
        extra.event = await updateEvent(slug, { name: body.name as string | undefined, gender: body.gender as Gender | undefined, circles: body.circles as number | undefined });
        break;
      case "event-activate":
        extra.event = await activateEvent(slug);
        break;
      case "event-delete":
        await deleteEvent(slug);
        break;
      case "start":
        extra.event = await startEvent(slug);
        break;
      case "reset":
        extra.event = await resetEvent(slug);
        break;
      case "reset-circle":
        await resetCircle(slug, Math.round(Number(body.circle)));
        break;
      case "undo-circle":
        await undoCircle(slug, Math.round(Number(body.circle)), body.to == null ? undefined : Math.round(Number(body.to)));
        break;
      case "control":
        extra.event = await setControl(slug, {
          hallScene: body.hallScene as string | undefined,
          focusCircle: body.focusCircle as number | null | undefined,
          compare: body.compare as [number, number] | null | undefined,
          reveal: body.reveal as boolean | undefined,
        });
        break;
      case "sim":
        extra.written = await simWrite(slug, (Array.isArray(body.rows) ? body.rows : []) as { circle: number; snapshot: Snapshot; creations?: { standing: number[]; sentence: string; photo?: string | null } }[]);
        break;
      default:
        return NextResponse.json({ ok: false, error: `פעולה לא מוכרת: ${action}` }, { status: 400 });
    }
  } catch (e) {
    const status = e instanceof SanityError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status });
  }
  return NextResponse.json({ ok: true, ...extra, view: await studioView() }, { headers: { "cache-control": "no-store" } });
}
