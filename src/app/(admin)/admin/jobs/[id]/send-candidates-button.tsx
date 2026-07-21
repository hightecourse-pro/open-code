"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { sendJobCandidatesToClient } from "@/app/(admin)/admin/actions";

/**
 * Emails the linked client the curated candidates for this job, with a link
 * straight into the portal job view. Shows the action's ok/error inline.
 */
export function SendCandidatesButton({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  function send() {
    setResult(null);
    start(async () => {
      const r = await sendJobCandidatesToClient(jobId);
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Button type="button" onClick={send} disabled={pending} className="w-fit">
        {pending ? "שולח…" : "שליחת המועמדות ללקוח 📧"}
      </Button>
      {result?.ok && <Alert variant="success">המייל נשלח ללקוח ✓</Alert>}
      {result?.error && <Alert variant="danger">{result.error}</Alert>}
    </div>
  );
}
