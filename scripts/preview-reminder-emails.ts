// Renders the two questionnaire-reminder emails to HTML files and, with
// --send, mails samples to ONE address through the staging Resend key.
// usage: NEXT_PUBLIC_SITE_URL=https://app.opencode.org.il npx tsx scripts/preview-reminder-emails.ts [--send <email>]
import fs from "node:fs";
import path from "node:path";
import { questionnaireReminderEmail } from "../src/lib/email/templates";

const outDir = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : ".";
const mentor = questionnaireReminderEmail("רבקה", "mentor");
const junior = questionnaireReminderEmail("שרה", "junior");
fs.writeFileSync(path.join(outDir, "reminder-mentor.html"), mentor.html);
fs.writeFileSync(path.join(outDir, "reminder-junior.html"), junior.html);
console.log("subjects:", JSON.stringify([mentor.subject, junior.subject]));

const sendIdx = process.argv.indexOf("--send");
if (sendIdx > -1) {
  const to = process.argv[sendIdx + 1];
  const key = process.env.RESEND_API_KEY ?? "";
  const from = process.env.EMAIL_FROM ?? "";
  if (!key || !from || !to) throw new Error("missing RESEND_API_KEY / EMAIL_FROM / recipient");
  for (const m of [mentor, junior]) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: `[דוגמה] ${m.subject}`, html: m.html }),
    });
    console.log("sent:", r.status, m.subject);
  }
}
