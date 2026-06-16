import type { Metadata } from "next";
import { Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "הקלטות סשנים" };

const COVERS = [
  "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
  "bg-[linear-gradient(135deg,#6B3D99,#464CA0)]",
  "bg-[linear-gradient(135deg,#1F1E3F,#464CA0)]",
  "bg-[linear-gradient(135deg,#36C57B,#28A864)]",
  "bg-[linear-gradient(135deg,#FFB85C,#E5A93C)]",
  "bg-[linear-gradient(135deg,#913F80,#E0418D)]",
];

function minutes(sec: number): string {
  return `${Math.round(sec / 60)} דק'`;
}

export default async function RecordingsPage() {
  const supabase = await createClient();
  const { data: recordings } = await supabase
    .from("recordings")
    .select("*")
    .order("published_at", { ascending: false });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הקלטות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הקלטות סשנים</h1>
        <p className="t-body-sm text-ink-700">כל הסשנים השבועיים, זמינים לצפייה בכל זמן.</p>
      </div>

      {recordings && recordings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recordings.map((rec) => {
            const cover = COVERS[(rec.cover_variant - 1) % COVERS.length];
            return (
              <a
                key={rec.id}
                href={rec.video_url ?? "#"}
                className="bg-white border border-ink-200 rounded-2xl overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={cn("h-24 relative flex items-center justify-center", cover)}>
                  <div className="w-[42px] h-[42px] rounded-full bg-white/90 flex items-center justify-center text-brand-pink-deep shadow-md">
                    <Play size={18} fill="currentColor" className="ms-0.5" />
                  </div>
                  <span className="absolute bottom-2 left-2 bg-ink-1000/80 text-white text-[10.5px] font-mono px-1.5 py-0.5 rounded">
                    {minutes(rec.duration_sec)}
                  </span>
                  {rec.is_free && (
                    <span className="absolute top-2 right-2 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      חינם
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  {rec.category && (
                    <div className="font-mono text-[10.5px] text-brand-pink-deep">{rec.category}</div>
                  )}
                  <div className="font-display font-bold text-sm text-ink-1000 leading-tight my-0.5">
                    {rec.title}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          עדיין אין הקלטות זמינות.
        </div>
      )}
    </div>
  );
}
