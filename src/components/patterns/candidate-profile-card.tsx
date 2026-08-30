import {
  BadgeCheck,
  Briefcase,
  Code2,
  Compass,
  FlaskConical,
  GraduationCap,
  Info,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Avatar, Badge, type BadgeProps } from "@/components/ui";
import type { CandidateDetail, CandidateField } from "@/lib/portal/candidates";

type Icon = React.ComponentType<{ size?: number; className?: string }>;

// Mirrors the portal's grouping (app/portal/candidate/[id]) — the preview must
// read like the page it previews.
const GROUPS: { title: string; icon: Icon; tone: BadgeProps["variant"]; keys: string[] }[] = [
  {
    title: "ניסיון תעסוקתי",
    icon: Briefcase,
    tone: "purple",
    keys: ["work_history", "years_experience", "exp_role", "current_workplace", "work_description"],
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
    keys: ["dev_tech", "exp_tech", "language_skills"],
  },
  {
    title: "בינה מלאכותית",
    icon: Sparkles,
    tone: "pink",
    keys: ["genai_practiced", "ai_tools_used"],
  },
  {
    title: "הכשרה ולימודים",
    icon: GraduationCap,
    tone: "indigo",
    keys: ["study_place", "track_specialization", "certificate", "unique_courses", "graduation_year"],
  },
  {
    title: "זמינות והעדפות",
    icon: Compass,
    tone: "purple",
    keys: ["remote_commute", "practicum_placement", "job_offer_types"],
  },
];

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
  const rest = fields.filter((f) => !claimed.has(f.key));
  if (rest.length > 0) {
    groups.push({ title: "מידע נוסף", icon: Info, tone: "purple", keys: [], items: rest });
  }
  return groups;
}

function prettyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

export function CandidateProfileCard({ candidate }: { candidate: CandidateDetail }) {
  const groups = groupFields(candidate);
  return (
    <div className="flex flex-col gap-5">
      <header className="overflow-hidden rounded-[18px] border border-ink-200 bg-white shadow-sm">
        <div aria-hidden className="bg-brand-gradient h-1.5" />
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <Avatar
            initials={candidate.initials}
            size="xl"
            tone="pink"
            className="h-20 w-20 text-[30px] shadow-glow-pink"
          />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדת/&gt;</span>
            <h1 className="font-display mt-1 text-[28px] leading-tight font-black text-ink-1000">
              {candidate.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
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

      {candidate.links.length > 0 && (
        <section className="rounded-[18px] border border-brand-purple/25 bg-tint-purple/40 p-6">
          <h2 className="font-display mb-3 flex items-center gap-2.5 text-lg font-bold text-ink-1000">
            <Code2 size={18} className="text-brand-purple" />
            פרויקטים וקוד
          </h2>
          <ul className="flex flex-col gap-1.5">
            {candidate.links.map((link) => (
              <li key={`${link.label}-${link.url}`} className="text-sm">
                <span className="font-semibold text-ink-1000">{link.label}: </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="text-brand-purple"
                >
                  {prettyUrl(link.url)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map((group) => (
        <section
          key={group.title}
          className="rounded-[18px] border border-ink-200 bg-white p-6 shadow-sm"
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
          עוד אין כאן הרבה — ככל שתמלאי יותר בפרופיל, כך המגייסות יראו יותר.
        </p>
      )}
    </div>
  );
}

function FieldRow({ field, tone }: { field: CandidateField; tone: BadgeProps["variant"] }) {
  return (
    <div>
      <dt className="t-micro mb-2 font-semibold text-ink-700 uppercase">{field.label}</dt>
      <dd>
        {field.kind === "experience" ? (
          <div className="flex flex-col gap-3">
            {(field.entries ?? []).map((entry, i) => (
              <div
                key={`${entry.headline}-${i}`}
                className="rounded-[14px] border border-ink-100 bg-ink-0/60 p-4"
              >
                <div className="text-[15px] font-bold text-ink-1000">{entry.headline}</div>
                {entry.tech.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {entry.tech.map((t) => (
                      <Badge key={t} variant="tech">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {entry.description && (
                  <p className="t-body-sm mt-2.5 max-w-[68ch] whitespace-pre-line text-ink-900">
                    {entry.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : field.kind === "chips" ? (
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
