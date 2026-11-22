import { NextResponse } from "next/server";
import { getProfile, hasHcAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The song, automatically (optional): the studio sends the lyrics and the
 * style to a Suno API service (Suno has no official API; sunoapi.org or any
 * service with the same interface), and polls until two tracks come back.
 * Configured by SUNO_API_KEY + SUNO_BASE (+ SUNO_MODEL) on the server;
 * without them the studio keeps the manual way (copy the words into suno.com).
 *   {action: "generate", title, style, lyrics, exclude} → {taskId}
 *   {action: "status", taskId} → {status, tracks: [{audioUrl, title}]}
 */
export async function POST(req: Request) {
  const profile = await getProfile().catch(() => null);
  if (!hasHcAccess(profile)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const key = process.env.SUNO_API_KEY;
  const base = (process.env.SUNO_BASE ?? "https://api.sunoapi.org").replace(/\/+$/, "");
  const model = process.env.SUNO_MODEL ?? "V4_5";
  if (!key) return NextResponse.json({ ok: false, configured: false, error: "Suno לא מוגדר בשרת (SUNO_API_KEY)" }, { status: 501 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
  try {
    if (body.action === "generate") {
      const r = await fetch(`${base}/api/v1/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ customMode: true, instrumental: false, model, title: String(body.title ?? "").slice(0, 80), style: String(body.style ?? "").slice(0, 1000), prompt: String(body.lyrics ?? "").slice(0, 3000), negativeTags: String(body.exclude ?? "").slice(0, 200), callBackUrl: "" }),
      });
      const j = (await r.json().catch(() => null)) as { code?: number; msg?: string; data?: { taskId?: string } } | null;
      const taskId = j?.data?.taskId;
      if (!r.ok || !taskId) return NextResponse.json({ ok: false, error: j?.msg ?? `Suno ענה ${r.status}`, raw: j }, { status: 502 });
      return NextResponse.json({ ok: true, taskId });
    }
    if (body.action === "status") {
      const taskId = String(body.taskId ?? "");
      if (!taskId) return NextResponse.json({ ok: false, error: "חסר taskId" }, { status: 400 });
      const r = await fetch(`${base}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`, { headers });
      const j = (await r.json().catch(() => null)) as { data?: { status?: string; response?: { sunoData?: { audioUrl?: string; streamAudioUrl?: string; title?: string }[] } } } | null;
      const tracks = (j?.data?.response?.sunoData ?? []).map((t) => ({ audioUrl: t.audioUrl || t.streamAudioUrl || "", title: t.title ?? "" })).filter((t) => t.audioUrl);
      return NextResponse.json({ ok: true, status: j?.data?.status ?? "PENDING", tracks });
    }
    return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 502 });
  }
}
