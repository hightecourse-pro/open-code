import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LiveError, adminView, deleteQuestion, exportCsv, finalsControl, moveQuestion, questionControl, resetQuestion, saveChallenge, saveJudges, saveQuestion, updateLiveSettings, yemotTest, moveChallenge } from "@/lib/hackathon-live";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** An admin session, or the cron secret (the team's own check scripts). */
async function allowed(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await createAdminClient().from("profiles").select("role").eq("id", user.id).maybeSingle();
  return p?.role === "admin";
}

/** `?export=csv` - the finals and every question, for the record. */
export async function GET(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.get("export") === "csv") {
    return new Response(await exportCsv(), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="finals.csv"; filename*=UTF-8''${encodeURIComponent("תוצאות-הגמר.csv")}` },
    });
  }
  return NextResponse.json(await adminView({ poll: false }));
}

/**
 * The control panel's one door. `{action, ...}`:
 *   settings {eventName, phoneDisplay, yemotToken?, clearToken?, yemotExtension, weightsJudges, audienceMode, reveal, theme, criteria}
 *   yemot-test
 *   question-save {id?, text, options, reveal} · question-delete {id} · question-move {id, direction} · question-reset {id}
 *   control {op: open|close|toggle|next|prev|goto|archive, id?}
 *   challenge-save {key, name?, finalists?: [{name, team, teamKey?}]}
 *   judges-save {judges: [{id?, name, challengeKey}]}
 *   challenge-move {key, direction: up|down}
 *   finals {op: open|close|reveal|hide|show|clear|current|reset|question, key, finalistId?}
 * Every answer carries the fresh admin view.
 */
export async function POST(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  let extra: Record<string, unknown> = {};
  try {
    switch (action) {
      case "settings":
        await updateLiveSettings(body);
        break;
      case "yemot-test":
        extra = { test: await yemotTest() };
        break;
      case "question-save":
        extra = { question: await saveQuestion({ id: typeof body.id === "string" ? body.id : undefined, text: body.text, options: body.options, reveal: body.reveal }) };
        break;
      case "question-delete":
        await deleteQuestion(String(body.id ?? ""));
        break;
      case "question-move":
        await moveQuestion(String(body.id ?? ""), body.direction === "up" ? "up" : "down");
        break;
      case "question-reset":
        await resetQuestion(String(body.id ?? ""));
        break;
      case "control":
        await questionControl(String(body.op ?? ""), typeof body.id === "string" ? body.id : null);
        break;
      case "challenge-save":
        await saveChallenge(String(body.key ?? ""), { name: body.name, finalists: body.finalists });
        break;
      case "challenge-move":
        await moveChallenge(String(body.key ?? ""), body.direction === "up" ? "up" : "down");
        break;
      case "judges-save":
        await saveJudges(body.judges);
        break;
      case "finals":
        await finalsControl(String(body.op ?? ""), typeof body.key === "string" && body.key ? body.key : null, { finalistId: body.finalistId });
        break;
      default:
        return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 404 });
    }
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true, ...extra, view: await adminView({ poll: false }) });
}
