import {
  BadgeCheck,
  Briefcase,
  Code2,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Info,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Avatar, Badge, type BadgeProps } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CandidateDetail, CandidateField } from "@/lib/portal/candidates";

type Icon = React.ComponentType<{ size?: number; className?: string }>;

/**
 * THE candidate profile — one renderer for the member's preview, the team's
 * member view and the employer portal, so they can never drift apart again
 * (the owner, 31/8: "זה אמור להיות זהה אחד לאחד").
 *
 * Layout is a bento grid: card sizes play along and across by how much each
 * group actually says, instead of identical cards stacked one under the
 * other. Only employer-relevant data appears — work-mode preferences and
 * "what she's looking for" stop mattering the moment we submitted her.
 */
const GROUPS: { title: string; icon: Icon; tone: BadgeProps["variant"]; keys: string[] }[] = [
  {
    title: "ניסיון תעסוקתי",
    icon: Briefcase,
    tone: "purple",
    keys: [
      "work_history",
      "years_experience",
      "exp_role",
      "currently_working",
      "current_employment",
      "current_employment_place",
      "current_workplace",
      "work_description",
    ],
  },
  {
    title: "התנסות מעשית",
    icon: FlaskConical,
    tone: "mint",
    keys: [
      "practical_experience",
      "practicum_done",
      "practicum_employer",
      "practicum_period",
      "practicum_tech",
      "practicum_description",
      "practicum_placement",
    ],
  },
  {
    title: "מיומנויות טכניות",
    icon: Code2,
    tone: "tech",
    keys: ["dev_tech", "tech_stack", "exp_tech", "exp_languages", "language_skills"],
  },
  {
    title: "בינה מלאכותית",
    icon: Sparkles,
    tone: "pink",
    keys: ["genai_known", "genai_practiced", "ai_tools_used", "ai_gaps"],
  },
  {
    title: "הכשרה ולימודים",
    icon: GraduationCap,
    tone: "indigo",
    keys: ["study_place", "track_specialization", "certificate", "unique_courses", "graduation_year"],
  },
];

/**
 * Her preferences, not her qualifications — an employer reading a submitted
 * profile has no business with these (the owner, 31/8: "גם רמת ההיברידיות
 * ומה מחפשת לא קשור למעסיק אחרי שהגשנו למשרה").
 */
const NOT_FOR_EMPLOYERS = new Set([
  "remote_commute",
  "job_offer_types",
  "specific_job",
  "paid_placement",
]);

function isHeaderField(field: CandidateField, candidate: CandidateDetail): boolean {
  if (field.key === "bio") return true;
  if (field.key === "specialization") return !!candidate.specialization;
  if (field.key === "region") return !!candidate.region;
  return false;
}

function groupFields(candidate: CandidateDetail) {
  const fields = candidate.fields.filter(
    (f) => !isHeaderField(f, candidate) && !NOT_FOR_EMPLOYERS.has(f.key)
  );
  const claimed = new Set<string>();
  const groups = GROUPS.map((group) => {
    const items = fields.filter((f) => group.keys.includes(f.key));
    for (const item of items) claimed.add(item.key);
    return { ...group, items };
  }).filter((group) => group.items.length > 0);
  const rest = fields.filter((f) => !claimed.has(f.key));
  if (rest.length > 0) {
    groups.push({ title: "מידע נוסף", icon: Info, tone: "purple", keys: [], items: rest });
  }
  return groups;
}

/** How much a group has to SAY — that is what earns it a wider card. */
function groupWeight(items: CandidateField[]): number {
  let w = 0;
  for (const f of items) {
    if (f.kind === "experience") w += Math.max(3, (f.entries?.length ?? 1) * 3);
    else if (f.kind === "chips") w += 1 + Math.floor(f.values.length / 8);
    else if (f.kind === "links") w += 1;
    else w += f.values.join(" ").length > 120 ? 3 : 1.5;
  }
  return w;
}

/**
 * Weighted spans need enough cards to fill rows; a SPARSE profile (the owner,
 * 31/8: "אם חסר נתונים זה לא יפה ולא סימטרי") switches to symmetric spans so
 * one or two cards still compose a full, balanced row.
 */
function spanClass(weight: number, totalCards: number): string {
  if (totalCards <= 1) return "md:col-span-6 xl:col-span-12";
  if (totalCards === 2) return "md:col-span-3 xl:col-span-6";
  if (totalCards === 3) return "md:col-span-2 xl:col-span-4";
  if (weight >= 6) return "md:col-span-6 xl:col-span-7";
  if (weight >= 3) return "md:col-span-3 xl:col-span-5";
  return "md:col-span-3 xl:col-span-4";
}

const TONE_BUBBLE: Record<string, string> = {
  purple: "bg-tint-purple text-brand-purple",
  mint: "bg-tint-mint text-[#1B7A4B]",
  tech: "bg-ink-100 text-ink-900",
  pink: "bg-tint-pink text-brand-pink-deep",
  indigo: "bg-tint-indigo text-brand-indigo",
};

function prettyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

export function CandidateProfileCard({
  candidate,
  headerExtra,
}: {
  candidate: CandidateDetail;
  /** Page-specific control in the header corner (e.g. the portal's favorite star). */
  headerExtra?: React.ReactNode;
}) {
  const groups = groupFields(candidate);
  const totalCards = groups.length + (candidate.links.length > 0 ? 1 : 0);
  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------- hero card */}
      <header className="overflow-hidden rounded-[18px] border border-ink-200 bg-white shadow-sm print:border-ink-100 print:shadow-none">
        <div aria-hidden className="bg-brand-gradient h-1.5" />
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-7">
          <Avatar
            initials={candidate.initials}
            size="xl"
            tone="pink"
            className="h-20 w-20 text-[30px] shadow-glow-pink"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדת/&gt;</span>
                <h1 className="font-display mt-1 text-[28px] leading-tight font-black text-ink-1000 sm:text-[32px]">
                  {candidate.name}
                </h1>
              </div>
              {headerExtra && <div className="shrink-0 print:hidden">{headerExtra}</div>}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              {candidate.specialization && (
                <span className="font-display text-[15px] font-bold text-brand-purple">
                  {candidate.specialization}
                </span>
              )}
              {candidate.region && (
                <span className="t-body-sm inline-flex items-center gap-1.5">
                  <MapPin size={15} className="text-ink-500" />
                  {candidate.region}
                </span>
              )}
              {candidate.isExperienced && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-crown-gold-soft bg-tint-warm px-3 py-[5px] text-xs font-semibold text-crown-gold">
                  <BadgeCheck size={14} />
                  בעלת ניסיון בתעשייה
                </span>
              )}
            </div>
            {candidate.bio && (
              <p className="t-body mt-4 max-w-[68ch] whitespace-pre-line text-ink-900">
                {candidate.bio}
              </p>
            )}
            {candidate.headline.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.headline.map((item) => (
                  <Badge key={item} variant="tech">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------- the bento */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12 md:[grid-auto-flow:dense]">
        {candidate.links.length > 0 && (
          <section
            className={cn(
              "rounded-[18px] border border-brand-purple/25 bg-tint-purple/40 p-5 break-inside-avoid",
              spanClass(candidate.links.length > 2 ? 6 : 3, totalCards)
            )}
          >
            <h2 className="font-display mb-1 flex items-center gap-2.5 text-[16px] font-bold text-ink-1000">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-purple">
                <Code2 size={15} />
              </span>
              פרויקטים וקוד
            </h2>
            <p className="t-caption mb-3.5">קוד ופרויקטים חיים שהיא בנתה — שווה מבט לפני השיחה.</p>
            <ul className="grid gap-2.5 sm:grid-cols-1 xl:grid-cols-2">
              {candidate.links.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-[14px] border border-ink-200 bg-white px-3.5 py-2.5 transition-shadow duration-150 hover:no-underline hover:shadow-md"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint-purple text-brand-purple">
                      <ExternalLink size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-1000 group-hover:text-brand-purple">
                        {link.label}
                      </span>
                      <span dir="ltr" className="t-caption block truncate text-start">
                        {prettyUrl(link.url)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {groups.map((group) => {
          const weight = groupWeight(group.items);
          return (
            <section
              key={group.title}
              className={cn(
                "rounded-[18px] border border-ink-200 bg-white p-5 shadow-sm break-inside-avoid print:shadow-none",
                spanClass(weight, totalCards)
              )}
            >
              <h2 className="font-display mb-4 flex items-center gap-2.5 text-[16px] font-bold text-ink-1000">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    TONE_BUBBLE[group.tone ?? "purple"] ?? TONE_BUBBLE.purple
                  )}
                >
                  <group.icon size={15} />
                </span>
                {group.title}
              </h2>
              <dl className="flex flex-col gap-4">
                {group.items.map((field) => (
                  <FieldRow key={field.key} field={field} tone={group.tone} />
                ))}
              </dl>
            </section>
          );
        })}
      </div>

      {groups.length === 0 && candidate.links.length === 0 && (
        <p className="t-body-sm rounded-[18px] border border-dashed border-ink-200 bg-white p-6 text-center">
          עוד אין כאן הרבה — ככל שהפרופיל מלא יותר, כך המגייסות רואות יותר.
        </p>
      )}
    </div>
  );
}

function FieldRow({ field, tone }: { field: CandidateField; tone: BadgeProps["variant"] }) {
  return (
    <div className="break-inside-avoid">
      <dt className="t-micro mb-1.5 font-semibold text-ink-700 uppercase">{field.label}</dt>
      <dd>
        {field.kind === "experience" ? (
          <div className="flex flex-col gap-2.5">
            {(field.entries ?? []).map((entry, i) => (
              <div
                key={`${entry.headline}-${i}`}
                className="rounded-[14px] border border-ink-100 bg-ink-0/60 p-3.5"
              >
                <div className="text-[14.5px] font-bold text-ink-1000">{entry.headline}</div>
                {entry.tech.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.tech.map((t) => (
                      <Badge key={t} variant="tech">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {entry.description && (
                  <p className="t-body-sm mt-2 max-w-[68ch] whitespace-pre-line text-ink-900">
                    {entry.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : field.kind === "chips" ? (
          <div className="flex flex-wrap gap-1.5">
            {field.values.map((value) => (
              <Badge key={value} variant={tone}>
                {value}
              </Badge>
            ))}
          </div>
        ) : field.kind === "links" ? (
          <div className="flex flex-col gap-1">
            {field.values.map((value) => (
              <a
                key={value}
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="t-body-sm truncate text-start text-brand-purple"
              >
                {prettyUrl(value)}
              </a>
            ))}
          </div>
        ) : (
          <div className="t-body-sm max-w-[68ch] whitespace-pre-line text-ink-900">
            {field.values.join(" · ")}
          </div>
        )}
      </dd>
    </div>
  );
}
