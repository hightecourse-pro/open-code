"use server";

import { savePrepAnswers } from "@/lib/hc-preconf/data";
import { AI_TOOLS, DEV_TOOLS, TOOL_NONE, TOOL_OTHER, type PrepAnswers } from "@/lib/hc-preconf/config";

const clean = (v: unknown, max = 200): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const KNOWN = new Set<string>([...DEV_TOOLS, ...AI_TOOLS, TOOL_OTHER, TOOL_NONE]);

/** The questionnaire's answers for the token's participant - the server keeps only the fields it knows. */
export async function submitPrepAnswers(token: string, input: PrepAnswers): Promise<{ ok: boolean; error?: string }> {
  if (typeof token !== "string" || !/^[a-f0-9]{24}$/i.test(token)) return { ok: false, error: "bad_token" };
  const tools = Array.isArray(input.tools) ? input.tools.filter((t): t is string => typeof t === "string" && KNOWN.has(t)).slice(0, 10) : [];
  const answers: PrepAnswers = {
    role: clean(input.role),
    office: clean(input.office),
    laptop: input.laptop === "yes" || input.laptop === "no" ? input.laptop : undefined,
    tools,
    toolsOther: clean(input.toolsOther),
    license: input.license === "work" || input.license === "private" || input.license === "both" ? input.license : "",
    mgmtRole: clean(input.mgmtRole),
    employees: clean(input.employees, 40),
    years: clean(input.years, 40),
    note: clean(input.note, 600),
  };
  return savePrepAnswers(token, answers);
}
