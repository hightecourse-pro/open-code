import Link from "next/link";
import { Avatar, Badge, Card } from "@/components/ui";
import { FavoriteButton } from "./favorite-button";
import type { CandidateSummary } from "@/lib/portal/types";

/**
 * The candidate card shared by search results, a job's candidate list and the
 * favorites page. Only summary fields are shown — the private detail lives
 * behind the profile page, itself privacy-filtered.
 */
export function CandidateCard({
  candidate,
  favorited,
}: {
  candidate: CandidateSummary;
  favorited: boolean;
}) {
  return (
    <div className="relative h-full">
      <div className="absolute end-3 top-3 z-10">
        <FavoriteButton profileId={candidate.id} initial={favorited} size="sm" />
      </div>
      <Link href={`/portal/candidate/${candidate.id}`} className="block h-full no-underline">
        <Card interactive className="h-full flex flex-col gap-3">
          <div className="flex items-center gap-3 pe-9">
            <Avatar initials={candidate.initials} size="md" />
            <div className="min-w-0">
              <p className="font-display font-bold text-ink-1000 truncate">{candidate.name}</p>
              {candidate.specialization && (
                <p className="t-caption truncate">{candidate.specialization}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {candidate.region && <Badge variant="indigo">{candidate.region}</Badge>}
            {candidate.isExperienced && <Badge variant="mint">בעלת ניסיון</Badge>}
          </div>

          {candidate.headline.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
              {candidate.headline.map((tech) => (
                <Badge key={tech} variant="tech">
                  {tech}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </Link>
    </div>
  );
}
