"use client";
// A project's stage in the second design: the catalogue picture with a play button that swaps in the
// demo video (streamed through our own domain - nothing loads until the click), the tags, the team,
// ״מה שמעבר לאתגר״, and the two doors: the video and the live system in the cloud.
import Image from "next/image";
import { useRef, useState } from "react";
import { CHALLENGE_INFO, hasStream, teamName, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { AwardTag, BTN_INK, BTN_PINK, ChallengeChip } from "../ui";

export function ProjectStage({ p }: { p: ShowcaseProject }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const streamable = hasStream(p);
  const src = `/api/hackathon-2026/projects/${p.k8}/video`;
  const title = teamName(p);
  const c = CHALLENGE_INFO[p.challenge];

  const play = () => {
    if (!streamable) return;
    setPlaying(true);
    stage.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 md:gap-12 items-start">
      <div ref={stage} className="relative bg-[#1B1530] rounded-[14px] border border-[#ECE8F2] overflow-hidden scroll-mt-20" data-testid="sh-stage" data-playing={playing ? "1" : "0"}>
        {playing && streamable && !failed ? (
          <video src={src} poster={p.image ?? undefined} controls autoPlay playsInline preload="metadata" className="block w-full aspect-video bg-black" onError={() => setFailed(true)} data-testid="sh-video">
            הדפדפן לא מנגן את הסרטון כאן.
          </video>
        ) : (
          <button type="button" onClick={play} className="relative block w-full aspect-video group outline-none" aria-label={streamable ? "לצפייה בסרטון" : title} disabled={!streamable}>
            {p.image && <Image src={p.image} alt={p.caption ?? title} fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover object-top" priority />}
            {streamable && !failed && (
              <>
                <span className="absolute inset-0 bg-gradient-to-t from-[#1B1530]/60 via-transparent to-transparent" aria-hidden />
                <span className="absolute inset-0 m-auto w-[72px] h-[72px] rounded-full bg-white text-[#D81B5C] flex items-center justify-center text-[28px] ps-1 group-hover:scale-105 transition-transform" aria-hidden>
                  ▶
                </span>
                <span className="absolute bottom-4 inset-x-0 text-center text-white font-bold text-[15px]" aria-hidden>
                  לצפייה בסרטון
                </span>
              </>
            )}
          </button>
        )}
        {failed && (
          <p className="px-4 py-3 text-white text-[14.5px] bg-[#2A2244]" data-testid="sh-video-failed">
            הסרטון לא נטען כאן.{" "}
            {p.video?.link && (
              <a href={p.video.link} target="_blank" rel="noopener noreferrer" className="underline font-bold">
                לצפייה בקישור של הצוות ↗
              </a>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <ChallengeChip k={p.challenge} />
          <AwardTag p={p} />
          <span className="text-[13.5px] text-[#6B6580]">{c.org}</span>
        </div>
        <h1 className="text-[32px] sm:text-[42px] font-black leading-[1.1] text-[#1B1530]" style={{ textWrap: "balance" }} data-testid="sh-title">
          {title}
        </h1>
        <div>
          <div className="text-[13px] font-bold text-[#B0154B]">מה שמעבר לאתגר</div>
          <p className="text-[17px] leading-relaxed text-[#1B1530] mt-1" data-testid="sh-blurb">
            {p.blurb}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1" data-testid="sh-actions">
          {streamable ? (
            <button type="button" onClick={play} className={BTN_PINK} data-testid="sh-play-btn">
              לצפייה בסרטון
            </button>
          ) : p.video?.link ? (
            <a href={p.video.link} target="_blank" rel="noopener noreferrer" className={BTN_PINK} data-testid="sh-video-link">
              לצפייה בסרטון ↗
            </a>
          ) : null}
          {p.productUrl && (
            <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className={BTN_INK} data-testid="sh-live">
              למערכת החיה בענן ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
