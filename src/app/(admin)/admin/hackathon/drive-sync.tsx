"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { chooseDriveFolder, listDriveFolders } from "./actions";

interface Folder {
  id: string;
  name: string;
  owner?: string | null;
  sharedDrive?: boolean;
}
interface SyncResult {
  total: number;
  done: number;
  mirrored: number;
  shared: number;
  remaining: number;
  errors: string[];
  error?: string;
}

/**
 * The videos in Drive (the owner, 23/10): pick the folder she shared with the
 * service account, then one button mirrors every video and shares each one
 * personally with the judges of its challenge. Runs in passes of a few
 * minutes until nothing is left.
 */
export function DriveSync({ folder, total, done }: { folder: Folder | null; total: number; done: number }) {
  const [current, setCurrent] = useState<Folder | null>(folder);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [pending, start] = useTransition();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done, total });
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function loadFolders() {
    setError(null);
    start(async () => {
      const r = await listDriveFolders();
      if (r.error) return setError(r.error);
      setFolders(r.folders ?? []);
    });
  }
  function pick(f: Folder) {
    setError(null);
    start(async () => {
      const r = await chooseDriveFolder(f.id, f.name);
      if (r.error) return setError(r.error);
      setCurrent(f);
      setFolders(null);
    });
  }
  async function sync() {
    setRunning(true);
    setError(null);
    setLog([]);
    try {
      for (let pass = 0; pass < 30; pass++) {
        const res = await fetch("/api/admin/hackathon/drive-sync", { method: "POST" });
        const r = (await res.json()) as SyncResult;
        if (!res.ok || r.error) {
          setError(r.error ?? "הסנכרון נכשל");
          break;
        }
        setProgress({ done: r.done, total: r.total });
        setLog((l) => [...l, `סבב ${pass + 1}: הועתקו ${r.mirrored}, שותפו ${r.shared}${r.errors.length ? ` · ${r.errors.length} שגיאות` : ""}`, ...r.errors]);
        if (r.remaining === 0 || (r.mirrored === 0 && r.errors.length > 0)) break;
      }
    } catch {
      setError("הסנכרון נכשל. נסי שוב.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-ink-200 px-4 py-3 flex flex-col gap-2" data-testid="drive-sync">
      <div className="flex items-center gap-2 flex-wrap text-[13px]">
        <b className="text-ink-900">הסרטונים בדרייב:</b>
        {current ? (
          <span className="text-ink-700">
            תיקייה ״{current.name}״ · <b>{progress.done}</b> / {progress.total} סרטונים בדרייב
          </span>
        ) : (
          <span className="text-ink-500">עוד לא נבחרה תיקייה.</span>
        )}
        <Button type="button" size="sm" variant="secondary" disabled={pending || running} onClick={loadFolders} className="ms-auto">
          {current ? "החלפת תיקייה" : "בחירת תיקייה ששותפה"}
        </Button>
        {current && (
          <Button type="button" size="sm" disabled={pending || running} onClick={sync} data-testid="drive-sync-run">
            {running ? "מסנכרנת…" : "סנכרון סרטונים ושיתוף לשופטות"}
          </Button>
        )}
      </div>
      {folders && (
        <div className="flex flex-wrap gap-1.5">
          {folders.length === 0 && <span className="text-[12.5px] text-ink-500">לא נמצאו כוננים שיתופיים או תיקיות ששותפו עם חשבון השירות.</span>}
          {folders.map((f) => (
            <Button key={f.id} type="button" size="sm" variant="secondary" disabled={pending} onClick={() => pick(f)} data-testid="drive-folder" data-shared-drive={f.sharedDrive ? "1" : undefined}>
              {f.sharedDrive ? "🗂️" : "📁"} {f.name}
              {f.owner ? <span className="text-ink-400 font-normal"> · {f.owner}</span> : null}
            </Button>
          ))}
          <p className="basis-full text-[12px] text-ink-500">
            לחשבון שירות אין מקום אחסון משלו, אז ההעתקה עובדת רק לכונן שיתופי (Shared Drive) שחשבון השירות נוסף אליו כ״מנהל תוכן״, או לתיקייה רגילה כשמוגדרת הרשאת פעולה בשם משתמש (GOOGLE_DRIVE_UPLOAD_AS).
          </p>
        </div>
      )}
      <p className="text-[12px] text-ink-500">
        קובץ שהועלה לאתר וקישור דרייב (קובץ או תיקייה) שצוות הדביק מועתקים לתיקייה. התיקייה כולה משותפת (צפייה) עם כל שופטת ששובצה לאתגר ועם כל צוות האדמין; בנוסף כל סרטון משותף אישית עם השופטות של האתגר שלו. יוטיוב נשאר מוטמע. שופטת בלי חשבון גוגל רואה את הנגן הישיר דרך האתר.
      </p>
      {log.length > 0 && (
        <ul className="text-[12px] text-ink-700 bg-ink-50 rounded-md px-3 py-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto" data-testid="drive-sync-log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-[12.5px] font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
