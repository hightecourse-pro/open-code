// The candidate profile — the portal's showcase page.
//
// PRIVACY: every value on this page comes from loadCandidates(), which returns
// only listed/active/completed members and only answers to employer_visible
// questions. This file never queries profiles or profile_answers itself, and
// member_crm (VIP, internal notes) is not reachable from here at all.

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Code2,
  Compass,
  Download,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Info,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Alert, Avatar, Badge, Button, type BadgeProps } from "@/components/ui";
import { loadCandidates, type CandidateDetail, type CandidateField } from "@/lib/portal/candidates";
import { requirePortalClient } from "@/app/portal/session";

/**
 * loadCandidates() is a whole-list read; cache() collapses the metadata pass
 * and the render pass into a single one per request.
 */
const candidates = cache(loadCandidates);

async function findCandidate(id: string): Promise<CandidateDetail | null> {
  const { candidates: all } = await candidates();
  return all.find((c) => c.id === id) ?? null;
}

type Icon = React.ComponentType<{ size?: number; className?: string }>;

/**
 * Answers arrive as a flat, sort_order-ranked list. Grouping them turns a wall
 * of labels into something a hiring manager can skim in one pass; each group
 * also owns a chip tone so the page reads as sections rather than stripes.
 */
const GROUPS: { title: string; icon: Icon; tone: BadgeProps["variant"]; keys: string[] }[] = [
  {
    title: "מיומנויות טכניות",
    icon: Code2,
    tone: "tech",
    keys: ["dev_tech", "tech_stack", "exp_tech", "exp_languages", "language_skills"],
  },
  {
    title: "ניסיון תעסוקתי",
    icon: Briefcase,
    tone: "purple",
    keys: [
      "years_experience",
      "exp_role",
      "currently_working",
      "current_workplace",
      "work_description",
      "specific_job",
    ],
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
    keys: [
      "study_place",
      "track_specialization",
      "certificate",
      "unique_courses",
      "graduation_year",
    ],
  },
  {
    title: "התנסות מעשית",
    icon: FlaskConical,
    tone: "mint",
    keys: ["practicum_done", "practicum_employer", "practicum_tech", "practicum_placement"],
  },
  {
    title: "זמינות והעדפות",
    icon: Compass,
    tone: "purple",
    keys: ["remote_commute", "paid_placement"],
  },
];

/** Already shown in the header — repeating them below would be noise. */
function isHeaderField(field: CandidateField, candidate: CandidateDetail): boolean {
  if (field.key === "bio") return true;
  if (field.key === "specialization") return !!candidate.specialization;
  if (field.key === "region") return !!candidate.region;
  return false;
}

function groupFields(candidate: CandidateDetail) {
  const fields = candidate.fields.filter((f) => !isHeaderField(f, candidate));
  const claimed = new Set<string>();

  const groups = GROUPS.map((group) => {
    const items = fields.filter((f) => group.keys.includes(f.key));
    for (const item of items) claimed.add(item.key);
    return { ...group, items };
  }).filter((group) => group.items.length > 0);

  // Anything a future question adds still has a home.
  const rest = fields.filter((f) => !claimed.has(f.key));
  if (rest.length > 0) {
    groups.push({ title: "מידע נוסף", icon: Info, tone: "purple", keys: [], items: rest });
  }
  return groups;
}

/** "github.com/ada" reads better on a link chip than the raw URL. */
function prettyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const candidate = await findCandidate(id);
  return { title: candidate ? candidate.name : "מועמדת" };
}

export default async function CandidateProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cv?: string }>;
}) {
  await requirePortalClient();
  const [{ id }, { cv }] = await Promise.all([params, searchParams]);

  // Not being in loadCandidates() is indistinguishable from not existing — that
  // is the whole listing gate, and it must not leak which of the two it was.
  const candidate = await findCandidate(id);
  if (!candidate) notFound();

  const groups = groupFields(candidate);
  const cvHref = `/portal/candidate/${candidate.id}/cv`;

  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-0">
      <Link
        href="/portal"
        className="t-body-sm inline-flex w-fit items-center gap-1.5 font-semibold text-ink-700 transition-colors duration-150 hover:text-brand-purple print:hidden"
      >
        <ArrowRight size={16} />
        חזרה לחיפוש
      </Link>

      {cv === "none" && (
        <Alert variant="info" title="עדיין אין קורות חיים בתיק">
          המועמדת לא העלתה קובץ קורות חיים. הפרופיל כאן מכיל את כל מה שהיא שיתפה איתנו — ואפשר לפנות
          אלינו ונשלים את הקובץ מולה.
        </Alert>
      )}
      {cv === "error" && (
        <Alert variant="warn" title="לא הצלחנו לפתוח את הקובץ">
          משהו השתבש בהורדת קורות החיים. נסו שוב בעוד רגע, ואם זה חוזר — דברו איתנו ונטפל בזה.
        </Alert>
      )}

      {/* ---------------------------------------------------------- header */}
      <header className="overflow-hidden rounded-[18px] border border-ink-200 bg-white shadow-sm print:border-ink-100 print:shadow-none">
        <div aria-hidden className="bg-brand-gradient h-1.5" />
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
          <Avatar
            initials={candidate.initials}
            size="xl"
            tone="pink"
            className="h-20 w-20 text-[30px] shadow-glow-pink sm:h-24 sm:w-24 sm:text-[34px]"
          />

          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדת/&gt;</span>
            <h1 className="font-display mt-1 text-[30px] leading-tight font-black text-ink-1000 sm:text-[36px]">
              {candidate.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
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
              <p className="t-body-lg mt-5 max-w-[68ch] whitespace-pre-line text-ink-900">
                {candidate.bio}
              </p>
            )}

            {candidate.headline.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
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

      {/* ------------------------------------------------ body + side rail */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
        <div className="flex flex-col gap-6">
          {candidate.links.length > 0 && <ProjectLinks links={candidate.links} />}

          {groups.map((group) => (
            <section
              key={group.title}
              className="rounded-[18px] border border-ink-200 bg-white p-6 shadow-sm break-inside-avoid print:shadow-none"
            >
              <h2 className="font-display mb-5 flex items-center gap-2.5 text-lg font-bold text-ink-1000">
                <group.icon size={18} className="text-brand-purple" />
                {group.title}
              </h2>
              <dl className="flex flex-col gap-5">
                {group.items.map((field) => (
                  <FieldRow key={field.key} field={field} tone={group.tone} />
                ))}
              </dl>
            </section>
          ))}

          {groups.length === 0 && candidate.links.length === 0 && (
            <p className="t-body-sm rounded-[18px] border border-dashed border-ink-200 bg-white p-6 text-center">
              הפרופיל המלא של {candidate.name} עדיין בהשלמה. קורות החיים שלה זמינים להורדה.
            </p>
          )}
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block print:hidden">
          <div className="rounded-[18px] border border-ink-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-bold text-ink-1000">קורות חיים</h2>
            <p className="t-caption mt-1.5">
              הקובץ המלא של {candidate.name}, כפי שהיא שיתפה אותו איתנו.
            </p>
            <Button asChild variant="primary" size="md" className="mt-4 w-full">
              <a href={cvHref}>
                <Download size={17} />
                הורדת קורות חיים
              </a>
            </Button>
          </div>
        </aside>
      </div>

      {/* The rail collapses on narrow screens, so the primary action follows
          the reader down the page instead of disappearing above the fold. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-white/95 p-3 backdrop-blur-sm lg:hidden print:hidden">
        <Button asChild variant="primary" size="md" className="w-full">
          <a href={cvHref}>
            <Download size={17} />
            הורדת קורות חיים
          </a>
        </Button>
      </div>
    </div>
  );
}

/** GitHub and live projects are the strongest signal here — given room to breathe. */
function ProjectLinks({ links }: { links: { label: string; url: string }[] }) {
  return (
    <section className="rounded-[18px] border border-brand-purple/25 bg-tint-purple/40 p-6 break-inside-avoid">
      <h2 className="font-display mb-1 flex items-center gap-2.5 text-lg font-bold text-ink-1000">
        <Code2 size={18} className="text-brand-purple" />
        פרויקטים וקוד
      </h2>
      <p className="t-caption mb-4">קוד פתוח ופרויקטים חיים שהיא בנתה — שווה מבט לפני השיחה.</p>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {links.map((link) => (
          <li key={`${link.label}-${link.url}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-[14px] border border-ink-200 bg-white px-4 py-3 transition-shadow duration-150 hover:no-underline hover:shadow-md"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-purple text-brand-purple">
                <ExternalLink size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-1000 group-hover:text-brand-purple">
                  {link.label}
                </span>
                {/* dir=ltr so the URL is not bidi-scrambled inside the RTL page. */}
                <span dir="ltr" className="t-caption block truncate text-start">
                  {prettyUrl(link.url)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FieldRow({ field, tone }: { field: CandidateField; tone: BadgeProps["variant"] }) {
  return (
    <div className="break-inside-avoid">
      <dt className="t-micro mb-2 font-semibold text-ink-700 uppercase">{field.label}</dt>
      <dd>
        {field.kind === "chips" ? (
          <div className="flex flex-wrap gap-2">
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
          <div className="t-body max-w-[68ch] whitespace-pre-line text-ink-900">
            {field.values.join(" · ")}
          </div>
        )}
      </dd>
    </div>
  );
}
