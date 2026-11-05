"use client";
// The hackathon's logo with motion (the owner, 5/11: ״צריך את הלוגו של ההאקתון עם הנפשה״) - the jump of the
// finals' tickets popup, through the Web Animations API so it moves even where the system turned CSS
// animations off (her machine, by the look of her screenshots).
import Image from "next/image";
import { useEffect, useRef } from "react";

const JUMP: Keyframe[] = [
  { transform: "translateY(0) rotate(0deg) scale(1)", offset: 0 },
  { transform: "translateY(-26px) rotate(-10deg) scale(1.12)", offset: 0.08 },
  { transform: "translateY(0) rotate(8deg) scale(0.95)", offset: 0.18 },
  { transform: "translateY(-15px) rotate(-7deg) scale(1.08)", offset: 0.28 },
  { transform: "translateY(0) rotate(5deg) scale(0.98)", offset: 0.38 },
  { transform: "translateY(-6px) rotate(-2deg) scale(1.02)", offset: 0.46 },
  { transform: "translateY(0) rotate(0deg) scale(1)", offset: 0.52 },
  { transform: "translateY(0) rotate(0deg) scale(1)", offset: 1 },
];

export function HackathonLogo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    const a = el.animate(JUMP, { duration: 3200, iterations: Infinity, easing: "ease-in-out", delay: 500 });
    return () => a.cancel();
  }, []);
  return (
    <Image
      ref={ref}
      src="/hackathon-2026/logo-hackathon.png"
      alt="האקתון AI 2026 - לפצח את קוד הכניסה"
      width={1600}
      height={934}
      priority
      className={className}
      style={{ transformOrigin: "50% 70%" }}
      data-testid="sh-logo"
    />
  );
}
