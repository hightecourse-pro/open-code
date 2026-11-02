"use client";
// A project's stage: the catalogue picture with a play button that swaps in the demo video
// (streamed through our own domain from the Drive mirror / the uploaded file - nothing loads
// until the click), the team, the challenge, ״מה שמעבר לאתגר״ and the two doors: the video and
// the live system in the cloud. A video that fails to load shows the participant's own link.
import Image from "next/image";
import { useRef, useState } from "react";
import { CHALLENGE_INFO, hasStream, teamName, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { AwardBadge, ChallengeBadge } from "../showcase-ui";

export function ProjectHero({ p }: { p: ShowcaseProject }) {
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
    <div className="grid grid-cols-1 md:grid-cols-[1.08fr_1fr] gap-8 md:gap-10 items-start">
      <div
        ref={stage}
        className="relative bg-ink-1000 border-2 border-ink-900/10 shadow-[7px_8px_0_0_#F3C6DD] overflow-hidden -rotate-1 md:-rotate-[1.2deg] scroll-mt-20"
        style={{ borderRadius: "24px 30px 22px 28px" }}
        data-testid="sc-stage"
        data-playing={playing ? "1" : "0"}
      >
        {playing && streamable && !failed ? (
          <video
            src={src}
            poster={p.image ?? undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="block w-full aspect-video bg-black sc-pop"
            onError={() => setFailed(true)}
            data-testid="sc-video"
          >
            הדפדפן לא מנגן את הסרטון כאן.
          </video>
        ) : (
          <button type="button" onClick={play} className="relative block w-full aspect-video group outline-none" aria-label={streamable ? "לצפייה בסרטון" : title} disabled={!streamable}>
            {p.image && <Image src={p.image} alt={p.caption ?? title} fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover object-top" priority />}
            {streamable && !failed && (
              <>
                <span className="absolute inset-0 bg-gradient-to-t from-ink-1000/55 via-transparent to-transparent" aria-hidden />
                <span className="sc-play absolute inset-0 m-auto w-[76px] h-[76px] rounded-full bg-white text-brand-pink-deep flex items-center justify-center text-[30px] ps-1 group-hover:scale-110 transition-transform" aria-hidden>
                  ▶
                </span>
                <span className="absolute bottom-4 inset-x-0 text-center text-white font-bold text-[15px] drop-shadow" aria-hidden>
                  לצפייה בסרטון ההדגמה
                </span>
              </>
            )}
          </button>
        )}
        {failed && (
          <p className="px-4 py-3 text-white text-[14.5px] bg-ink-900" data-testid="sc-video-failed">
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
          <ChallengeBadge k={p.challenge} />
          <AwardBadge p={p} large />
          <span className="text-[13.5px] text-ink-500">{c.org}</span>
        </div>
        <h1 className="font-display font-black text-[32px] sm:text-[40px] leading-[1.1] text-ink-900" style={{ textWrap: "balance" }} data-testid="sc-title">
          {title}
        </h1>
        <div>
          <div className="text-[12.5px] font-extrabold tracking-wide text-brand-pink-deep">מה שמעבר לאתגר</div>
          <p className="t-body-lg text-ink-900 leading-relaxed mt-1" data-testid="sc-blurb">
            {p.blurb}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1" data-testid="sc-actions">
          {streamable ? (
            <button
              type="button"
              onClick={play}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-white font-bold text-[16px] px-5 py-2.5 shadow-md hover:-translate-y-0.5 transition-transform"
              data-testid="sc-play-btn"
            >
              לצפייה בסרטון
            </button>
          ) : p.video?.link ? (
            <a
              href={p.video.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-white font-bold text-[16px] px-5 py-2.5 shadow-md hover:-translate-y-0.5 transition-transform"
              data-testid="sc-video-link"
            >
              לצפייה בסרטון ↗
            </a>
          ) : null}
          {p.productUrl && (
            <a
              href={p.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white border-2 border-brand-purple text-brand-purple font-bold text-[16px] px-5 py-2.5 shadow-[3px_4px_0_0_#EDE4F7] hover:bg-brand-purple hover:text-white transition-colors"
              data-testid="sc-live"
            >
              למערכת החיה בענן ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
