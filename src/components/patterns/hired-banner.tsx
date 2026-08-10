export interface HiredMember {
  full_name: string;
}

/**
 * Festive congratulations for women who recently started a new job
 * (members with found_job + hired_at, and off-community placements — both
 * within the celebration window). Names only — a member's workplace is never
 * shown to other members. Server component — the caller queries and passes
 * the names; renders nothing when empty.
 */
export function HiredBanner({ members }: { members: HiredMember[] }) {
  if (members.length === 0) return null;

  const names = members.map((m) => m.full_name).join(", ");

  return (
    <div className="bg-brand-gradient text-white rounded-[18px] p-5 shadow-glow-pink">
      <div className="flex items-start gap-3">
        <span className="text-[26px] leading-none" aria-hidden>
          🎉
        </span>
        <div className="flex flex-col gap-1">
          <div className="font-display font-black text-[17px]">
            מזל טוב לחברות שלנו שמתחילות עבודה :)
          </div>
          <div className="text-[14px] font-semibold opacity-95">🎊 {names} 🎊</div>
          <div className="text-[12.5px] opacity-85">
            כל הקהילה מרימה איתן כוסית — שתהיה הצלחה ענקית 💜
          </div>
        </div>
      </div>
    </div>
  );
}
