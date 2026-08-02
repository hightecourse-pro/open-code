"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Alert, Input, Select } from "@/components/ui";
import { AdminCreateJob } from "./admin-create-job";
import { AdminJobRow, type AdminJob, type PortalClientOption } from "./admin-job-row";

const PIPELINE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "כל הסטטוסים" },
  { value: "draft", label: "לא פורסם" },
  { value: "published", label: "פורסם" },
  { value: "candidates_sent", label: "נשלחו מועמדות" },
  { value: "interviews", label: "ראיונות" },
  { value: "hired", label: "גויס" },
  { value: "closed_no_hire", label: "נסגר ללא גיוס" },
];

/**
 * A job that finished its journey sinks below the ones still in play.
 * Drafts count as in-play (they're being prepared), a hired/closed pipeline —
 * or a published job that was manually closed — counts as done.
 */
function isDone(j: AdminJob): boolean {
  if (j.pipeline_status === "hired" || j.pipeline_status === "closed_no_hire") return true;
  return j.status === "closed" && j.pipeline_status !== "draft";
}

export function AdminJobsManager({
  jobs,
  clients,
  initialClientId,
  created,
}: {
  jobs: AdminJob[];
  clients: PortalClientOption[];
  initialClientId?: string;
  created?: boolean;
}) {
  // Arriving from the CRM with a client in hand → the form opens ready.
  const [formOpen, setFormOpen] = useState(Boolean(initialClientId));
  const [q, setQ] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [src, setSrc] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = jobs.filter(
      (j) =>
        (!needle ||
          j.title.toLowerCase().includes(needle) ||
          j.company.toLowerCase().includes(needle)) &&
        (!pipeline || j.pipeline_status === pipeline) &&
        (!src || j.source === src)
    );
    // Default order: live jobs (open, not yet hired/closed) first, newest inside.
    return [...filtered].sort(
      (a, b) =>
        Number(isDone(a)) - Number(isDone(b)) ||
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
  }, [jobs, q, pipeline, src]);

  return (
    <div className="flex flex-col gap-4">
      {created && <Alert variant="success">המשרה נוספה ✓ הנה היא ברשימה.</Alert>}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        {/* Header: title on the right, + on the left (RTL end). */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-display text-base font-bold">כל המשרות ({jobs.length})</h3>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            title={formOpen ? "סגירת הטופס" : "הוספת משרה"}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-white text-[13px] font-semibold px-4 py-2 hover:brightness-105 transition-[filter] cursor-pointer"
          >
            {formOpen ? <X size={15} /> : <Plus size={15} />}
            {formOpen ? "סגירה" : "משרה חדשה"}
          </button>
        </div>

        {formOpen && (
          <div className="mb-4 rounded-md border border-brand-purple/25 bg-tint-purple/20 p-4">
            <AdminCreateJob clients={clients} initialClientId={initialClientId} />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-48">
            <Search
              size={14}
              aria-hidden
              className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400 pointer-events-none"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש לפי תפקיד או חברה…"
              className="ps-9"
              aria-label="חיפוש משרות"
            />
          </div>
          <Select
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value)}
            aria-label="סינון לפי סטטוס"
            className="w-auto"
          >
            {PIPELINE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            aria-label="סינון לפי מקור"
            className="w-auto"
          >
            <option value="">כל המקורות</option>
            <option value="ours">שלנו</option>
            <option value="open">מהשוק</option>
          </Select>
        </div>

        <div className="flex flex-col">
          {list.map((j) => (
            <AdminJobRow key={j.id} job={j} />
          ))}
          {list.length === 0 && (
            <p className="text-ink-500 text-sm py-4">
              {jobs.length === 0 ? "אין משרות עדיין." : "אין משרות שמתאימות לסינון."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
