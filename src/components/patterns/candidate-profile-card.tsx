import {
  BadgeCheck,
  Briefcase,
  Code2,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { Avatar, Badge, type BadgeProps } from "@/components/ui";
import { MessageBody } from "@/components/patterns/rich-text";
import { cn } from "@/lib/utils";
import type { CandidateDetail, CandidateField } from "@/lib/portal/candidates";
import type { ExperienceEntryDisplay } from "@/lib/portal/types";

type Icon = React.ComponentType<{ size?: number; className?: string }>;

/**
 * THE candidate profile — one renderer for the member's preview, the team's
 * member view and the employer portal, so they can never drift apart again
 * (the owner, 31/8: "זה אמור להיות זהה אחד לאחד").
 *
 * Design round (the owner, 9/9: "לא נעים לעין ולא מייצג ולא יכול להחליף
 * קורות חיים"): the bento became a proper CV — a strong identity header with
 * "קצת עליי" featured, a main column that reads like a resume (experience as
 * a timeline, then the practical work, then live projects), and a compact
 * skills sidebar. No stranded half-empty cards.
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
    title: "ניסיון מעשי",
    icon: FlaskConical,
    tone: "mint",
    keys: [
      "practical_experience",
      "practicum_done",
      "practicum_kind",
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

/** The resume's main column — the story; everything else sits in the sidebar. */
const MAIN_TITLES = new Set(["ניסיון תעסוקתי", "ניסיון מעשי"]);

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
  // The employment sequence itself carries these (the owner, 31/8: "מיותר").
  "years_experience",
  "exp_role",
  "currently_working",
  // A placement preference, not a qualification (the owner, 31/8).
  "practicum_placement",
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
    return { ...group, items: [...items] };
  }).filter((group) => group.items.length > 0);
  const rest = fields.filter((f) => !claimed.has(f.key));
  if (rest.length > 0) {
    groups.push({ title: "מידע נוסף", icon: Info, tone: "purple", keys: [], items: rest });
  }
  foldPracticumIntoTimeline(groups);
  return groups;
}

/**
 * The practicum answers arrive as five separate fields — but on a CV they are
 * ONE experience entry (the owner, 9/9: "הפרקטיקום צריך להיכנס ברצף ההתנסות
 * המעשית"): employer, kind, period, tech and description fold into a single
 * timeline stop, and the yes/no field disappears (the entry itself says it).
 */
function foldPracticumIntoTimeline(groups: { title: string; items: CandidateField[] }[]) {
  const group = groups.find((g) => g.title === "ניסיון מעשי");
  if (!group) return;
  const take = (key: string): CandidateField | undefined => {
    const i = group.items.findIndex((f) => f.key === key);
    return i >= 0 ? group.items.splice(i, 1)[0] : undefined;
  };
  const first = (f?: CandidateField): string => f?.values?.[0]?.trim() ?? "";
  take("practicum_done");
  const kind = first(take("practicum_kind"));
  const employer = first(take("practicum_employer"));
  const period = first(take("practicum_period"));
  const tech = take("practicum_tech");
  const description = first(take("practicum_description"));
  if (!employer && !kind && !description) return;
  const entry: ExperienceEntryDisplay = {
    headline: [employer || kind, period].filter(Boolean).join(" · "),
    place: employer || kind || "פרקטיקום",
    kindLabel: employer ? kind || "פרקטיקום" : undefined,
    range: period,
    tech: tech?.values ?? [],
    description,
  };
  const timeline = group.items.find((f) => f.kind === "experience");
  if (timeline) timeline.entries = [...(timeline.entries ?? []), entry];
  else
    group.items.push({
      key: "practicum_entry",
      label: "",
      values: [entry.headline],
      kind: "experience",
      entries: [entry],
    });
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

/** A code-host link — listed under קוד, never given a screenshot tile. */
function isRepoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)(github\.com|gitlab\.com|bitbucket\.org)$/.test(host);
  } catch {
    return true; // an unparseable "url" has nothing to screenshot either
  }
}

/** A section's title row: icon bubble, title, and a hairline that closes the line. */
function SectionHead({ icon: IconCmp, title, tone }: { icon: Icon; title: string; tone?: string | null }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          TONE_BUBBLE[tone ?? "purple"] ?? TONE_BUBBLE.purple
        )}
      >
        <IconCmp size={15} />
      </span>
      <h2 className="font-display text-[17px] font-black text-ink-1000">{title}</h2>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-ink-200/80" />
    </div>
  );
}

export function CandidateProfileCard({
  candidate,
  headerExtra,
  teamContact,
  thumbs,
}: {
  candidate: CandidateDetail;
  /** Page-specific control in the header corner (e.g. the portal's favorite star). */
  headerExtra?: React.ReactNode;
  /**
   * TEAM-ONLY contact details (the owner, 31/8). Passed exclusively by the
   * admin member-profile page — the portal and the member preview never
   * provide it, so nothing here can leak to a client.
   */
  teamContact?: { phone?: string | null; email?: string | null };
  /**
   * url → base64 data URI of a live-site screenshot (lib/site-thumbs) —
   * inlined so Netfree has no external image to intercept (9/9).
   */
  thumbs?: Record<string, string>;
}) {
  const groups = groupFields(candidate);
  const mainGroups = groups.filter((g) => MAIN_TITLES.has(g.title));
  const sideGroups = groups.filter((g) => !MAIN_TITLES.has(g.title));
  const hasLinks = candidate.links.length > 0;
  const hasMain = mainGroups.length > 0 || hasLinks;

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------- identity */}
      <header className="overflow-hidden rounded-[20px] border border-ink-200 bg-white shadow-sm print:border-ink-100 print:shadow-none">
        <div aria-hidden className="bg-brand-gradient h-2" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
            <div className="relative shrink-0">
              <div aria-hidden className="absolute -inset-2 rounded-full bg-tint-pink/50 blur-md print:hidden" />
              <Avatar
                initials={candidate.initials}
                size="xl"
                tone="pink"
                className="relative h-[88px] w-[88px] text-[32px] shadow-glow-pink"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדת/&gt;</span>
                  <h1 className="font-display mt-0.5 text-[30px] leading-tight font-black text-ink-1000 sm:text-[34px]">
                    {candidate.name}
                  </h1>
                  {candidate.specialization && (
                    <div className="font-display mt-1 text-[16.5px] font-bold text-brand-purple">
                      {candidate.specialization}
                    </div>
                  )}
                </div>
                {headerExtra && <div className="shrink-0 print:hidden">{headerExtra}</div>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {(candidate.city || candidate.region) && (
                  <span className="t-body-sm inline-flex items-center gap-1.5 text-ink-700">
                    <MapPin size={15} className="text-ink-500" />
                    {[candidate.city, candidate.region].filter(Boolean).join(" · ")}
                  </span>
                )}
                {candidate.isExperienced && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-crown-gold-soft bg-tint-warm px-3 py-[5px] text-xs font-semibold text-crown-gold">
                    <BadgeCheck size={14} />
                    בעלת ניסיון בתעשייה
                  </span>
                )}
              </div>
              {teamContact && (teamContact.phone || teamContact.email) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  {teamContact.phone && (
                    <a
                      href={`tel:${teamContact.phone}`}
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-900 hover:text-brand-purple"
                    >
                      <Phone size={14} className="text-brand-purple" />
                      {teamContact.phone}
                    </a>
                  )}
                  {teamContact.email && (
                    <a
                      href={`mailto:${teamContact.email}`}
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-900 hover:text-brand-purple"
                    >
                      <Mail size={14} className="text-brand-purple" />
                      {teamContact.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          {candidate.bio && (
            <div className="mt-6 rounded-[14px] border-s-[3px] border-brand-pink bg-ink-50/70 p-4 sm:p-5">
              <div className="t-micro mb-1.5 font-bold text-brand-pink-deep uppercase">קצת עליי</div>
              <MessageBody
                body={candidate.bio}
                className="t-body whitespace-pre-line leading-relaxed text-ink-900"
              />
            </div>
          )}
        </div>
      </header>

      {/* -------------------------------------------------- resume columns */}
      <div
        className={cn(
          "grid grid-cols-1 gap-5 items-start",
          hasMain && sideGroups.length > 0 && "lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]"
        )}
      >
        {hasMain && (
          <div className="flex flex-col gap-5">
            {/* The proof leads (the owner, 9/9: "דוגמאות קוד/פרויקטים —
                תעלה יותר למעלה"): live work first, history after. */}
            {hasLinks && (
              <section className="rounded-[18px] border border-brand-purple/25 bg-tint-purple/40 p-5 sm:p-6 break-inside-avoid">
                <SectionHead icon={Code2} title="פרויקטים וקוד" tone="purple" />
                <p className="t-caption -mt-2 mb-3.5">קוד ופרויקטים חיים שהיא בנתה — שווה מבט לפני השיחה.</p>
                <ProjectLinks links={candidate.links} thumbs={thumbs} />
              </section>
            )}

            {mainGroups.map((group) => (
              <section
                key={group.title}
                className="rounded-[18px] border border-ink-200 bg-white p-5 sm:p-6 shadow-sm break-inside-avoid print:shadow-none"
              >
                <SectionHead icon={group.icon} title={group.title} tone={group.tone} />
                <div className="flex flex-col gap-4">
                  {group.items.map((field) => (
                    <MainField key={field.key} field={field} tone={group.tone} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {sideGroups.length > 0 && (
          <aside className="flex flex-col gap-5">
            {sideGroups.map((group) => (
              <section
                key={group.title}
                className="rounded-[18px] border border-ink-200 bg-white p-5 shadow-sm break-inside-avoid print:shadow-none"
              >
                <SectionHead icon={group.icon} title={group.title} tone={group.tone} />
                <dl className="flex flex-col gap-3.5">
                  {group.items.map((field) => (
                    <SideField key={field.key} field={field} tone={group.tone} />
                  ))}
                </dl>
              </section>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * The projects area, in two symmetric halves (the owner, 9/9: "הקוביות לא
 * סימטריות ומעורבב גיט ופרויקטים חיים"): live sites as uniform screenshot
 * tiles (a compact preview strip — never a full-bleed banner), code repos as
 * uniform list rows below.
 */
function ProjectLinks({
  links,
  thumbs,
}: {
  links: CandidateDetail["links"];
  thumbs?: Record<string, string>;
}) {
  const live = links.filter((l) => !isRepoUrl(l.url));
  const repos = links.filter((l) => isRepoUrl(l.url));
  return (
    <div className="flex flex-col gap-4">
      {live.length > 0 && (
        <ul className={cn("grid grid-cols-1 gap-3", live.length > 1 && "sm:grid-cols-2")}>
          {live.map((link) => {
            const thumb = thumbs?.[link.url];
            return (
              <li key={`${link.label}-${link.url}`} className="h-full">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-ink-200 bg-white transition-shadow duration-150 hover:no-underline hover:shadow-md"
                >
                  <span className="block h-24 shrink-0 overflow-hidden border-b border-ink-100 bg-ink-50">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- inline data URI
                      <img
                        src={thumb}
                        alt={`תצוגה של ${link.label}`}
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      // Same-size stand-in while the screenshot bakes — the
                      // tiles stay symmetric either way.
                      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-tint-purple to-tint-pink">
                        <ExternalLink size={22} className="text-brand-purple/50" />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 items-center gap-2.5 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink-1000 group-hover:text-brand-purple">
                        {link.label}
                      </span>
                      <span dir="ltr" className="t-caption block truncate text-start">
                        {prettyUrl(link.url)}
                      </span>
                    </span>
                    <ExternalLink size={14} className="shrink-0 text-brand-purple" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {repos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {repos.map((link) => (
            <li key={`${link.label}-${link.url}`}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-[12px] border border-ink-200 bg-white px-3.5 py-2.5 transition-shadow duration-150 hover:no-underline hover:shadow-md"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-900">
                  <Code2 size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-1000 group-hover:text-brand-purple">
                    {link.label}
                  </span>
                  {link.note && (
                    <span className="block text-[12px] leading-snug text-ink-700">{link.note}</span>
                  )}
                  <span dir="ltr" className="t-caption block truncate text-start">
                    {prettyUrl(link.url)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Experience-style entries as a timeline; anything else falls back to SideField. */
function MainField({ field, tone }: { field: CandidateField; tone: BadgeProps["variant"] }) {
  if (field.kind !== "experience") {
    return (
      <dl>
        <SideField field={field} tone={tone} />
      </dl>
    );
  }
  return (
    <div>
      {field.label && field.label !== "ניסיון תעסוקתי" && field.label !== "התנסות מעשית" && (
        <div className="t-micro mb-2 font-semibold text-ink-700 uppercase">{field.label}</div>
      )}
      <ol className="relative ms-1.5 flex flex-col gap-5 border-s-2 border-ink-100 ps-5">
        {(field.entries ?? []).map((entry, i) => (
          <li key={`${entry.place}-${i}`} className="relative">
            <span
              aria-hidden
              className="absolute -start-[27px] top-1.5 h-3 w-3 rounded-full bg-brand-gradient ring-4 ring-white"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                {entry.role && (
                  <div className="text-[15.5px] font-bold leading-tight text-ink-1000">{entry.role}</div>
                )}
                <div className="text-[14px] font-semibold leading-snug text-brand-purple">
                  {entry.place}
                  {entry.kindLabel && (
                    <span className="ms-2 text-[11.5px] font-semibold text-ink-500">· {entry.kindLabel}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {entry.current && (
                  <span className="whitespace-nowrap rounded-full bg-tint-mint px-2 py-0.5 text-[10.5px] font-bold text-[#0F6E4A]">
                    מקום נוכחי/אחרון
                  </span>
                )}
                {entry.range && (
                  <span dir="ltr" className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-ink-500">
                    {entry.range}
                  </span>
                )}
              </div>
            </div>
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
              <MessageBody
                body={entry.description}
                className="t-body-sm mt-2 max-w-[70ch] whitespace-pre-line text-ink-900"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SideField({ field, tone }: { field: CandidateField; tone: BadgeProps["variant"] }) {
  return (
    <div className="break-inside-avoid">
      <dt className="t-micro mb-1.5 font-semibold text-ink-700 uppercase">{field.label}</dt>
      <dd>
        {field.kind === "chips" ? (
          field.chipGroups && field.chipGroups.length > 1 ? (
            <div className="flex flex-col gap-2.5">
              {field.chipGroups.map((g) => (
                <div key={g.name}>
                  <div className="mb-1 text-[11px] font-bold text-ink-500">{g.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.values.map((value) => (
                      <Badge key={value} variant={tone}>
                        {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : field.values.length === 1 ? (
            // A lone select answer reads as a fact, not a tag cloud.
            <div className="t-body-sm font-semibold text-ink-900">{field.values[0]}</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {field.values.map((value) => (
                <Badge key={value} variant={tone}>
                  {value}
                </Badge>
              ))}
            </div>
          )
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
        ) : field.values.length === 1 ? (
          <MessageBody body={field.values[0]} className="t-body-sm max-w-[70ch] whitespace-pre-line text-ink-900" />
        ) : (
          <div className="t-body-sm max-w-[70ch] whitespace-pre-line text-ink-900">
            {field.values.join(" · ")}
          </div>
        )}
      </dd>
    </div>
  );
}
