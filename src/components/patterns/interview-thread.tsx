"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { finishInterview, sendAnswer, type TurnState } from "@/app/(app)/ai/interview/actions";

export interface InterviewTurn {
  id: string | number;
  role: string;
  text: string;
}

// Minimal typing for the Web Speech API (not in the TS DOM lib).
interface SpeechResultEvent {
  results: { 0: { 0: { transcript: string } } };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: (e: SpeechResultEvent) => void;
  onend: () => void;
  onerror: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "he-IL";
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

/**
 * Transcript + answer box in one component, so her answer can appear in the
 * transcript the instant she sends it. The Gemini round-trip takes seconds;
 * without the optimistic bubble and the "typing" row it reads as an Enter
 * that didn't register — the tester's exact words.
 */
export function InterviewThread({
  sessionId,
  turns,
  done,
}: {
  sessionId: string;
  turns: InterviewTurn[];
  done: boolean;
}) {
  const [answer, answerAction, answerPending] = useActionState<TurnState, FormData>(
    sendAnswer.bind(null, sessionId),
    {}
  );
  const [finish, finishAction, finishPending] = useActionState<TurnState, FormData>(
    finishInterview.bind(null, sessionId),
    {}
  );

  // Her answer joins the transcript immediately; the server's copy replaces it
  // when the revalidated turns arrive.
  const [bubbles, addPending] = useOptimistic<InterviewTurn[], string>(turns, (state, text) => [
    ...state,
    { id: "pending", role: "candidate", text },
  ]);

  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<Recognition | null>(null);
  const spokenRef = useRef<string | null>(null);
  const lastSentRef = useRef("");
  // Uncontrolled on purpose: a setState inside the form action is deferred to
  // the end of the async transition (React 19), so a controlled box kept her
  // words visible for the whole Gemini round-trip. The ref empties it the
  // instant she sends — same trick as the community chat composer.
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The box empties on send; a failed send puts her words back so she can
  // resend without retyping (unless she already started typing something new).
  useEffect(() => {
    const el = inputRef.current;
    if (answer.error && lastSentRef.current && el && !el.value) {
      el.value = lastSentRef.current;
      el.focus();
    }
  }, [answer]);

  const lastAgentText = [...bubbles].reverse().find((t) => t.role === "agent")?.text ?? null;

  // In voice mode, read each new interviewer question aloud.
  useEffect(() => {
    if (voice && lastAgentText && lastAgentText !== spokenRef.current) {
      spokenRef.current = lastAgentText;
      speak(lastAgentText);
    }
  }, [voice, lastAgentText]);

  // Keep the newest turn in view — hers on send, the interviewer's on arrival.
  const count = bubbles.length + (answerPending ? 1 : 0);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  function toggleVoice() {
    const next = !voice;
    if (next) {
      // Detect Web Speech support on first opt-in (avoids SSR/hydration mismatch).
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setSupported(false);
        return;
      }
    } else if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    setVoice(next);
  }

  function toggleListen() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "he-IL";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const el = inputRef.current;
      if (el) el.value = el.value ? `${el.value} ${transcript}` : transcript;
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  const error = answer.error || finish.error;
  const reason = answer.reason || finish.reason;
  // A transient "משהו השתבש" is not a key problem — pointing at the keys
  // screen for it convinced testers their key was broken when it wasn't.
  const keyIssue = reason && reason !== "error";

  return (
    <>
      {/* transcript */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
        {bubbles.map((t) => (
          <div
            key={t.id}
            className={cn(
              "max-w-[85%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap",
              t.role === "agent"
                ? "self-start bg-ink-100 text-ink-900"
                : "self-end bg-brand-gradient text-white",
              t.id === "pending" && "opacity-70"
            )}
          >
            {t.text}
          </div>
        ))}
        {(answerPending || finishPending) && (
          <div className="self-start px-4 py-2.5 rounded-2xl bg-ink-100 text-ink-500 text-[13.5px] flex items-center gap-2">
            <span className="inline-flex gap-1" aria-hidden>
              <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce [animation-delay:300ms]" />
            </span>
            {finishPending ? "מסכמת את המשוב שלך…" : "המראיינת מקלידה…"}
          </div>
        )}
        {bubbles.length === 0 && (
          <p className="text-ink-500 text-sm text-center py-4">הראיון מתחיל…</p>
        )}
        <div ref={endRef} />
      </div>

      {!done && (
        <div className="flex flex-col gap-3">
          {error && (
            <Alert variant="warn">
              {error}
              {keyIssue && (
                <a
                  href={`/ai/keys?next=/ai/interview/${sessionId}`}
                  className="block mt-1 font-semibold text-brand-purple underline"
                >
                  לניהול מפתחות ה-AI ←
                </a>
              )}
            </Alert>
          )}

          {/* voice mode toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoice}
              disabled={!supported}
              className={cn(
                "inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50",
                voice
                  ? "bg-brand-gradient text-white border-transparent"
                  : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
              )}
            >
              <Volume2 size={15} /> מצב קולי {voice ? "פעיל" : "כבוי"}
            </button>
            {voice && lastAgentText && (
              <button
                type="button"
                onClick={() => speak(lastAgentText)}
                className="text-[12.5px] text-brand-purple font-semibold"
              >
                השמעת השאלה שוב
              </button>
            )}
            {!supported && <span className="text-[12px] text-ink-500">הדפדפן לא תומך בקול — נסי Chrome</span>}
          </div>

          <form
            action={(fd) => {
              const sent = String(fd.get("answer") ?? "").trim();
              if (!sent) return;
              lastSentRef.current = sent;
              addPending(sent);
              if (inputRef.current) inputRef.current.value = "";
              answerAction(fd);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              name="answer"
              autoComplete="off"
              placeholder={listening ? "מקשיבה… דברי 🎙️" : "כתבי או דברי את התשובה שלך…"}
              className={cn(
                "flex-1 px-3.5 py-3 rounded-md border text-sm outline-none focus:border-brand-purple",
                listening ? "border-brand-pink bg-tint-pink/40" : "border-ink-300"
              )}
            />
            {voice && (
              <button
                type="button"
                onClick={toggleListen}
                aria-label="דיבור"
                className={cn(
                  "w-11 shrink-0 rounded-md flex items-center justify-center transition-colors",
                  listening ? "bg-brand-pink text-white animate-pulse" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                )}
              >
                <Mic size={18} />
              </button>
            )}
            <Button type="submit" disabled={answerPending}>
              {answerPending ? "…" : "שליחה"}
            </Button>
          </form>

          <form action={finishAction}>
            <Button type="submit" variant="secondary" size="sm" disabled={finishPending}>
              {finishPending ? "מסכם את המשוב…" : "סיום וקבלת משוב"}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
