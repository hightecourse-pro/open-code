import { NextResponse } from "next/server";
import { addParticipant, enterWithCode, hasTagsAccess, leaveTags, listParticipants, markPrinted } from "@/app/tags/server";

/*
  JSON endpoints of מערכת הדפסת תגים (/tags): `enter` takes the code and sets
  the cookie, `list` returns the sheet's rows, `printed` writes הודפס = כן on
  one ת.ז., `leave` drops the cookie. Everything but `enter` needs the cookie
  (or a signed-in admin) - 401 otherwise, which sends the desk back to the gate.
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

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

export async function GET(_req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== "list") return json({ ok: false, error: "unknown action" }, 404);
  if (!(await hasTagsAccess())) return json({ ok: false, error: "entry" }, 401);
  try {
    return json(await listParticipants());
  } catch (e) {
    console.error("[tags] list", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "משהו השתבש אצלנו - נסי שוב בעוד רגע." }, 500);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const body = await readBody(req);
  try {
    switch (action) {
      case "enter": {
        const code = typeof body.code === "string" ? body.code : "";
        const ok = code ? await enterWithCode(code) : false;
        return json(ok ? { ok: true } : { ok: false, error: "הקוד לא נכון - נסי שוב." });
      }
      case "leave":
        await leaveTags();
        return json({ ok: true });
      case "printed": {
        if (!(await hasTagsAccess())) return json({ ok: false, error: "entry" }, 401);
        const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
        const row = typeof body.row === "number" && Number.isFinite(body.row) ? body.row : undefined;
        return json(await markPrinted({ tz: str(body.tz), row, first: str(body.first), last: str(body.last) }));
      }
      case "add": {
        if (!(await hasTagsAccess())) return json({ ok: false, error: "entry" }, 401);
        const str = (v: unknown) => (typeof v === "string" ? v : "");
        return json(await addParticipant({ first: str(body.first), last: str(body.last), office: str(body.office), tz: str(body.tz) }));
      }
      default:
        return json({ ok: false, error: "unknown action" }, 404);
    }
  } catch (e) {
    console.error("[tags]", action, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "משהו השתבש אצלנו - נסי שוב בעוד רגע." }, 500);
  }
}
