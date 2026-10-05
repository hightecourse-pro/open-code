"use client";

import { useState, useTransition } from "react";
import { FileDown, Trash2, Upload } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, type MaterialRow } from "@/lib/hackathon-shared";
import { createHackathonMaterialUpload, deleteHackathonMaterial, finalizeHackathonMaterial } from "./actions";

/**
 * Upload / remove a challenge's materials. The file goes from the browser
 * straight into the private bucket through a signed upload slot (13 MB PDFs
 * never pass through a server action), then the row is written.
 */
export function MaterialsManager({ challenges, materials: initial }: { challenges: { key: string; short: string }[]; materials: MaterialRow[] }) {
  const [materials, setMaterials] = useState(initial);
  const [challengeKey, setChallengeKey] = useState(challenges[0]?.key ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload() {
    setError(null);
    if (!file) return setError("בחרי קובץ.");
    const name = title.trim() || file.name;
    setProgress("פותח העלאה…");
    const slot = await createHackathonMaterialUpload(challengeKey, file.name);
    if (slot.error || !slot.token || !slot.path) {
      setProgress(null);
      return setError(slot.error ?? "שגיאה");
    }
    setProgress(`מעלה ${formatBytes(file.size)}…`);
    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from("hackathon").uploadToSignedUrl(slot.path, slot.token, file, { upsert: true });
    if (upErr) {
      setProgress(null);
      return setError(`ההעלאה נכשלה: ${upErr.message}`);
    }
    setProgress("רושם…");
    const fin = await finalizeHackathonMaterial({ challengeKey, title: name, path: slot.path, sizeBytes: file.size });
    setProgress(null);
    if (fin.error) return setError(fin.error);
    setMaterials((prev) => [...prev, { id: `tmp-${Date.now()}`, challenge_key: challengeKey, title: name, file_path: slot.path!, size_bytes: file.size, created_at: new Date().toISOString() }]);
    setTitle("");
    setFile(null);
    // The temp id is only for display; a reload shows the real row.
    window.location.reload();
  }

  function remove(m: MaterialRow) {
    if (!confirm(`למחוק את ״${m.title}״? החברות לא יוכלו להוריד אותו יותר.`)) return;
    setError(null);
    start(async () => {
      const r = await deleteHackathonMaterial(m.id);
      if (r.error) return setError(r.error);
      setMaterials((prev) => prev.filter((x) => x.id !== m.id));
    });
  }

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
      <h2 className="font-display text-base font-bold">📄 חומרי האתגרים (להורדה למנויות)</h2>
      {challenges.map((c) => {
        const list = materials.filter((m) => m.challenge_key === c.key);
        return (
          <div key={c.key} className="border-t border-ink-100 pt-3">
            <div className="font-display font-bold text-[14px] text-ink-1000">{c.short}</div>
            {list.length === 0 ? (
              <div className="text-[12.5px] text-ink-500 mt-1">אין קבצים עדיין.</div>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {list.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-[13px]">
                    <a href={`/api/hackathon/materials/${m.id}`} className="inline-flex items-center gap-1.5 text-brand-purple hover:underline">
                      <FileDown size={14} /> {m.title}
                    </a>
                    <span className="text-ink-500 text-[12px]" dir="ltr">
                      {formatBytes(m.size_bytes)}
                    </span>
                    <button type="button" onClick={() => remove(m)} disabled={pending} className="ms-auto text-ink-400 hover:text-red-600 p-1" title="מחיקה" aria-label="מחיקה">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="border-t border-ink-100 pt-4 flex flex-col gap-3">
        <div className="font-display font-bold text-[14px] text-ink-1000 flex items-center gap-1.5">
          <Upload size={15} /> העלאת קובץ
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="אתגר" htmlFor="hm-challenge">
            <Select id="hm-challenge" value={challengeKey} onChange={(e) => setChallengeKey(e.target.value)}>
              {challenges.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.short}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="שם לתצוגה (לא חובה)" htmlFor="hm-title">
            <Input id="hm-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: התחייבויות - דוגמאות חלק 1" />
          </Field>
          <Field label="קובץ" htmlFor="hm-file">
            <input id="hm-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-[13px]" />
          </Field>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        <Button type="button" size="sm" onClick={upload} disabled={!!progress || !file} className="w-fit">
          {progress ?? "העלאה"}
        </Button>
      </div>
    </section>
  );
}
