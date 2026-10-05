import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileDown, Lock } from "lucide-react";
import { requireCommunityAccess, isSubscriber } from "@/lib/auth";
import { H26Style, Sparkle } from "@/app/hackathon-2026/shared";
import { challengeByKey, formatBytes, loadMaterials, loadMyRegistration } from "@/lib/hackathon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const c = challengeByKey(key);
  return { title: c ? `אתגר ${c.short}` : "האקתון" };
}

/**
 * One challenge: the brief, what exactly to build, the partner, and the
 * materials to download (subscribers only - the owner, 5/10).
 */
export default async function ChallengePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const c = challengeByKey(key);
  if (!c || !c.challenge) notFound();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);
  const [materials, registration] = await Promise.all([loadMaterials(key), subscriber ? loadMyRegistration(profile.id) : null]);
  const mine = registration?.challengeKey === key;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <H26Style />
      <Link href="/hackathon" className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-purple w-fit">
        <ArrowRight size={14} /> לכל האתגרים
      </Link>

      <div className="relative flex items-start gap-4">
        {c.badgeLogo && (
          <span className="w-16 h-16 shrink-0 -rotate-6 rounded-full overflow-hidden bg-white border-2 border-brand-pink/30 shadow-[3px_3px_0_0_#F3C6DD] flex items-center justify-center p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
          </span>
        )}
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;אתגר/&gt;</span>
          <h1 className="font-display text-[26px] font-black text-ink-1000 leading-tight">{c.short}</h1>
          {c.org && <p className="text-[13.5px] text-ink-500 mt-0.5">{c.org}</p>}
        </div>
      </div>

      <section className="bg-white border-2 border-ink-900/10 shadow-[3px_4px_0_0_#F3C6DD] p-5" style={{ borderRadius: "18px 24px 16px 22px" }}>
        <div className="font-mono text-[13px] text-brand-pink-deep">{"// האתגר"}</div>
        <p className="t-body text-ink-900 leading-relaxed mt-1">{c.challenge}</p>
        {c.details && c.details.length > 0 && (
          <>
            <div className="font-mono text-[13px] text-brand-pink-deep mt-4">{"// מה צריך לחלץ / לבנות"}</div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {c.details.map((d) => (
                <li key={d} className="flex items-start gap-2 text-[14px] text-ink-800">
                  <span className="mt-2 w-2 h-2 rounded-full bg-brand-pink-deep shrink-0" aria-hidden />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {c.partnerLogo && (
          <div className="mt-4">
            <span className="inline-block bg-white border border-ink-100 rounded-[12px] px-4 py-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.partnerLogo} alt={c.org ?? ""} className="h-12 w-auto max-w-full" />
            </span>
          </div>
        )}
      </section>

      {/* materials */}
      <section
        className={`relative border-2 p-5 ${subscriber ? "bg-white border-brand-purple/40" : "bg-ink-50 border-ink-200"}`}
        style={{ borderRadius: "24px 18px 26px 20px" }}
      >
        <Sparkle className="absolute -top-2.5 -right-2 w-6 h-6" color="#E0418D" />
        <h2 className="font-display text-[17px] font-black text-ink-1000 flex items-center gap-2">
          <FileDown size={16} className="text-brand-purple" /> חומרי האתגר
          {!subscriber && <Lock size={14} className="text-ink-400" />}
        </h2>
        {subscriber ? (
          materials.length === 0 ? (
            <p className="t-body-sm text-ink-600 mt-1.5">החומרים לאתגר הזה יעלו כאן בקרוב.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {materials.map((m) => (
                <li key={m.id}>
                  <a
                    href={`/api/hackathon/materials/${m.id}`}
                    className="flex items-center gap-3 rounded-[14px] border border-ink-200 bg-white px-3.5 py-2.5 hover:border-brand-purple hover:bg-tint-purple/30 transition-colors"
                  >
                    <FileDown size={16} className="text-brand-purple shrink-0" />
                    <span className="flex-1 min-w-0 font-bold text-[14px] text-ink-1000 truncate">{m.title}</span>
                    <span className="text-[12px] text-ink-500" dir="ltr">
                      {formatBytes(m.size_bytes)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="t-body-sm text-ink-700 mt-1.5">
            הורדת החומרים למנויות הקהילה.{" "}
            <Link href="/join" className="font-bold text-brand-purple hover:underline">
              להצטרפות 💜
            </Link>
          </p>
        )}
      </section>

      {/* register */}
      {subscriber && (
        <section className="bg-tint-purple/30 border-2 border-brand-purple/40 p-5" style={{ borderRadius: "20px 26px 18px 24px" }}>
          {mine ? (
            <p className="t-body-sm text-ink-900">
              את רשומה לאתגר הזה{registration?.partner ? ` יחד עם ${registration.partner.name}` : ""} ✓{" "}
              <Link href="/hackathon#register" className="font-bold text-brand-purple hover:underline">
                לשינוי ההרשמה
              </Link>
            </p>
          ) : (
            <Link
              href={`/hackathon?challenge=${c.key}#register`}
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-white bg-brand-gradient px-5 py-2.5 rounded-full hover:brightness-105"
            >
              נרשמת לאתגר הזה <ArrowLeft size={14} />
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
