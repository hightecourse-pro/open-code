import type { Metadata } from "next";
import { touchResults } from "@/lib/hc-touch";
import { rubik } from "../../ai-course/font";
import { TOUCH_Q, emptyCounts, type TouchResults } from "../content";
import { Screen } from "./screen";
import "./screen.css";

export const metadata: Metadata = { title: { absolute: "הטאצ' שלך · מסך הלד" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The LED wall of ״תני לנו את הטאצ' שלך״ (8 m × 2 m, 4:1): the answers as live
 * charts, one question at a time and then the ten leading answers together.
 * Public and read-only. A 3840×960 stage scaled to the screen; `?stretch=1`
 * squashes it into whatever the signal is (a 16:9 laptop that the wall's
 * processor stretches back). `?q=3` holds one question, `?q=all` the summary,
 * `?sec=12` changes the seconds per question.
 */
export default async function TouchScreenPage({ searchParams }: { searchParams: Promise<{ q?: string; stretch?: string; sec?: string }> }) {
  const sp = await searchParams;
  const n = Number(sp.q);
  const locked = sp.q === "all" ? TOUCH_Q : Number.isInteger(n) && n >= 1 && n <= TOUCH_Q ? n - 1 : null;
  const sec = Math.min(60, Math.max(4, Number(sp.sec) || 10));
  const initial: TouchResults = await touchResults().catch(() => ({ counts: emptyCounts(), total: 0, at: 0 }));
  return <Screen initial={initial} fontClass={rubik.className} stretch={sp.stretch === "1"} locked={locked} seconds={sec} />;
}
