import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Sparkles, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Alert, Button, ProgressRing } from "@/components/ui";
import { cn } from "@/lib/utils";
import { InterviewControls } from "@/components/patterns/interview-controls";

export const metadata: Metadata = { title: "ראיון" };

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();
  if (!session) notFound();

  const [{ data: turns }, { data: feedback }] = await Promise.all([
    supabase
      .from("interview_turns")
      .select("id, role, text")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase.from("interview_feedback").select("*").eq("session_id", sessionId).maybeSingle(),
  ]);

  const done = session.status === "done";
  const strengths = (feedback?.strengths as string[] | undefined) ?? [];
  const improvements = (feedback?.improvements as string[] | undefined) ?? [];
  const lastAgentText =
    [...(turns ?? [])].reverse().find((t) => t.role === "agent")?.text ?? null;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-glow-pink">
          <Sparkles size={18} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-ink-1000">סימולטור ראיונות</h1>
          <p className="text-xs text-ink-500">{done ? "הראיון הסתיים" : "הראיון בעיצומו"}</p>
        </div>
      </div>

      {/* transcript */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        {(turns ?? []).map((t) => (
          <div
            key={t.id}
            className={cn(
              "max-w-[85%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap",
              t.role === "agent"
                ? "self-start bg-ink-100 text-ink-900"
                : "self-end bg-brand-gradient text-white"
            )}
          >
            {t.text}
          </div>
        ))}
        {(turns ?? []).length === 0 && (
          <p className="text-ink-500 text-sm text-center py-4">הראיון מתחיל…</p>
        )}
      </div>

      {!done && <InterviewControls sessionId={sessionId} lastAgentText={lastAgentText} />}

      {done && !feedback && (
        <Alert variant="warn">
          לא הצלחנו להפיק משוב לראיון הזה — ייתכן שהמפתח נגמר.
          <a href="/ai/keys" className="block mt-1 font-semibold text-brand-purple underline">
            לניהול מפתחות ה-AI ←
          </a>
        </Alert>
      )}

      {done && feedback && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex gap-5 items-center">
            <ProgressRing value={feedback.overall_score ?? 0} size={96} />
            <div>
              <div className="font-display font-bold text-lg text-ink-1000">
                המשוב שלך 🎉 {feedback.overall_score}/100
              </div>
              <p className="t-body-sm text-ink-700 mt-1">{feedback.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
              <h3 className="font-display font-bold text-ink-1000 flex items-center gap-2 mb-3">
                <Check size={16} className="text-success" /> חוזקות
              </h3>
              <ul className="flex flex-col gap-2">
                {strengths.map((s, i) => (
                  <li key={i} className="text-[13.5px] text-ink-700 flex gap-2">
                    <span className="text-success">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
              <h3 className="font-display font-bold text-ink-1000 flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-brand-purple" /> לשיפור
              </h3>
              <ul className="flex flex-col gap-2">
                {improvements.map((s, i) => (
                  <li key={i} className="text-[13.5px] text-ink-700 flex gap-2">
                    <span className="text-brand-pink-deep">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href="/ai/interview">
            <Button variant="secondary" bracketed>
              ראיון נוסף
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
