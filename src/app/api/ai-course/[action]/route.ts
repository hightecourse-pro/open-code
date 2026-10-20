import { NextResponse } from "next/server";
import { finishQuiz, markSyllabusDownload, reportEvent, saveAnswer, setPlacement, startQuiz } from "@/app/ai-course/server";

/*
  JSON endpoints for the public AI-course quiz (see ai-course/server.ts for
  why these are route handlers and not server actions). Every answer is
  { ok: boolean, ... }; a bad request is still a 200 with ok:false so the
  client never has to tell a server error from a filtered network.
*/
export const dynamic = "force-dynamic";

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const body = await readBody(req);
  const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
  try {
    switch (action) {
      case "start":
        return json(await startQuiz(body));
      case "answer":
        return json(await saveAnswer(body.id, body.questionIndex, body.score));
      case "finish":
        return json(await finishQuiz(body.id, body.scores));
      case "placement":
        return json(await setPlacement(body.id, body.wants));
      case "download":
        return json(await markSyllabusDownload(body.id));
      case "report":
        return json(await reportEvent(body, req.headers.get("user-agent")));
      default:
        return json({ ok: false, error: "unknown action" }, 404);
    }
  } catch (e) {
    console.error("[ai-course]", action, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "משהו השתבש אצלנו - נסי שוב בעוד רגע." }, 500);
  }
}
