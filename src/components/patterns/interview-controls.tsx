"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { finishInterview, sendAnswer, type TurnState } from "@/app/(app)/ai/interview/actions";

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

export function InterviewControls({
  sessionId,
  lastAgentText,
}: {
  sessionId: string;
  lastAgentText: string | null;
}) {
  const [answer, answerAction, answerPending] = useActionState<TurnState, FormData>(
    sendAnswer.bind(null, sessionId),
    {}
  );
  const [finish, finishAction, finishPending] = useActionState<TurnState, FormData>(
    finishInterview.bind(null, sessionId),
    {}
  );

  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<Recognition | null>(null);
  const spokenRef = useRef<string | null>(null);

  // Clear the input after a successful send (keep it on error so she can resend).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state after the server action resolves
    if (!answer.error) setText("");
  }, [answer]);

  // In voice mode, read each new interviewer question aloud.
  useEffect(() => {
    if (voice && lastAgentText && lastAgentText !== spokenRef.current) {
      spokenRef.current = lastAgentText;
      speak(lastAgentText);
    }
  }, [voice, lastAgentText]);

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
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  const error = answer.error || finish.error;
  const reason = answer.reason || finish.reason;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="warn">
          {error}
          {reason && (
            <a href="/ai/keys" className="block mt-1 font-semibold text-brand-purple underline">
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

      <form action={answerAction} className="flex gap-2">
        <input
          name="answer"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
  );
}
