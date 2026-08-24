import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { QuestionToggle } from "@/components/patterns/question-toggle";
import { TaxonomyManager } from "@/components/patterns/taxonomy-manager";
import { QuestionOptionsEditor } from "@/components/patterns/question-options-editor";
import { QuestionOrder } from "./question-order";
import { PricingForm } from "@/components/patterns/pricing-form";
import { FeedbackQuestionsForm } from "@/components/patterns/feedback-questions-form";
import { getPricing } from "@/lib/payments/pricing";
import { getFeedbackAspects } from "@/lib/feedback-questions";
import { groupBySection } from "@/lib/profile-sections";
import { buildPlans, shekels } from "@/lib/payments/plans";
import type { ConfigTaxonomy, FieldType, TaxonomyKind } from "@/types/database";

export const metadata: Metadata = { title: "הגדרות" };

const FIELD_LABEL: Record<FieldType, string> = {
  text: "טקסט",
  select: "בחירה",
  multiselect: "בחירה מרובה",
  number: "מספר",
  bool: "כן/לא",
  tags: "תגיות",
};

const KIND_LABEL: Record<TaxonomyKind, string> = {
  tech: "טכנולוגיות",
  project_category: "קטגוריות פרויקט",
  region: "אזורים",
  specialization: "תחומים",
  list: "רשימות",
};

export default async function AdminConfigPage() {
  const supabase = await createClient();

  const [{ data: questions }, { data: taxonomies }, pricing, feedbackAspects] = await Promise.all([
    supabase
      .from("config_questions")
      .select("*")
      // Tie-break on created_at: seeded rows share sort_order values, and the
      // reorder arrows have to move a row relative to what she actually sees.
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("config_taxonomies")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    getPricing(),
    getFeedbackAspects(),
  ]);

  const plans = buildPlans(pricing);

  // group taxonomies by kind
  const byKind = new Map<TaxonomyKind, ConfigTaxonomy[]>();
  for (const t of taxonomies ?? []) {
    const arr = byKind.get(t.kind) ?? [];
    arr.push(t);
    byKind.set(t.kind, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;config/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הגדרות</h1>
        <p className="t-body-sm text-ink-500">
          כל שינוי כאן משתקף מיד אצל החברות — בלי לגעת בקוד.
        </p>
      </div>

      {/* Membership pricing */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">דמי מנוי</h3>
        <p className="text-[12.5px] text-ink-500 mb-4">
          המחיר שחברות חדשות רואות במסך ההצטרפות. המסלול השנתי מחושב אוטומטית לפי ההנחה.
        </p>
        <PricingForm pricing={pricing} />
        <div className="mt-4 pt-4 border-t border-ink-100 flex gap-6 text-sm">
          <div>
            <span className="text-ink-500">חודשי: </span>
            <span className="font-display font-bold text-ink-1000" dir="ltr">
              {shekels(plans.monthly.amountAgorot)} ₪
            </span>
          </div>
          <div className="text-ink-400">מנוי שנתי אינו מוצע יותר.</div>
        </div>
      </div>

      {/* Session feedback wording */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">שאלות המשוב על סשן</h3>
        <p className="text-[12.5px] text-ink-500 mb-4">
          מה שואלים חברה שהייתה בסשן — ארבע שאלות דירוג, בניסוח שלך.
        </p>
        <FeedbackQuestionsForm aspects={feedbackAspects} />
      </div>

      {/* Profile questions */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">שאלות הפרופיל</h3>
        <p className="text-[12.5px] text-ink-500 mb-4">
          השאלון מוצג לחברות כאשף בשלבים, והשאלות כאן מקובצות בדיוק לאותם שלבים ובאותו סדר — מה
          שאת רואה כאן הוא מה שהן רואות. החיצים מזיזים שאלה בתוך השלב שלה. כבי שאלה כדי להסתיר
          אותה בלי למחוק, ושימי לב לתוויות — לשאלה יכולים להיות תנאי הצגה נוספים מלבד היותה פעילה.
        </p>
        <div className="flex flex-col gap-6">
          {groupBySection(questions ?? []).map((section) => (
            <div key={section.title} className="flex flex-col">
              <div className="flex items-baseline gap-2 border-b-2 border-ink-200 pb-1.5">
                <h4 className="font-display text-[15px] font-bold text-ink-1000">{section.title}</h4>
                <span className="text-[11.5px] text-ink-400">
                  {section.questions.length === 1 ? "שאלה אחת" : `${section.questions.length} שאלות`}
                </span>
              </div>
              <p className="text-[11.5px] text-ink-500 mt-1 mb-1">{section.hint}</p>
          {section.questions.map((q, i) => {
            // A follow-up question is asked only when its parent bool is "כן" —
            // so if the parent is switched off, the follow-up can never show up
            // even while it says "פעילה". Say that out loud instead of leaving
            // her to guess why an enabled question doesn't reach the members.
            const parent = q.depends_on
              ? (questions ?? []).find((p) => p.key === q.depends_on)
              : undefined;
            const parentOff = !!q.depends_on && (!parent || !parent.active);
            // Structural questions drive the form's logic — they can't be disabled.
            const locked = q.key === "has_experience";
            const editable =
              (q.field_type === "select" || q.field_type === "multiselect") &&
              !q.taxonomy_kind &&
              q.key !== "city";
            const qOptions = Array.isArray(q.options)
              ? (q.options as unknown as { value: string; label: string }[])
              : [];
            return (
              <div key={q.id} className="flex flex-col py-3 border-b border-ink-100 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900">{q.label_he}</div>
                    <div className="text-xs text-ink-500 flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-mono">{q.key}</span>
                      <Badge variant="purple">{FIELD_LABEL[q.field_type]}</Badge>
                      {q.required && <Badge variant="pink">חובה</Badge>}
                      {q.taxonomy_kind && <Badge variant="tech">רשימה: {KIND_LABEL[q.taxonomy_kind]}</Badge>}
                      {q.key === "city" && <Badge variant="mint">רשימת ערים מ-gov.il</Badge>}
                      {locked && <Badge variant="tech">מובנית · חובה</Badge>}
                      {q.scope !== "all" && (
                        <Badge variant="indigo">{q.scope === "mentor" ? "מנטוריות" : "ג'וניוריות"}</Badge>
                      )}
                      {q.intake_track === "junior" && (
                        <Badge variant="mint">רק למי שבתחילת הדרך</Badge>
                      )}
                      {q.intake_track === "experienced" && (
                        <Badge variant="warm">רק למי שיש לה ניסיון</Badge>
                      )}
                      {q.depends_on && (
                        <Badge variant="tech">
                          רק אם ענתה כן על: {parent?.label_he ?? q.depends_on}
                        </Badge>
                      )}
                    </div>
                    {q.active && parentOff && (
                      <p className="text-[11.5px] text-[#8C5E0E] bg-tint-warm border border-[#F0DCA8] rounded-md px-2.5 py-1.5 mt-1.5">
                        {parent
                          ? `השאלה פעילה, אבל "${parent.label_he}" כבויה — כל עוד היא כבויה השאלה הזו לא תופיע אצל החברות. הפעילי אותה כדי שתחזור.`
                          : `השאלה פעילה, אבל השאלה שהיא תלויה בה (${q.depends_on}) לא קיימת — כך היא לא תופיע אצל החברות.`}
                      </p>
                    )}
                  </div>
                  <QuestionOrder id={q.id} index={i} total={section.questions.length} />
                  {locked ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-tint-mint text-[#1B7A4B]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#28A864]" />
                      פעילה · 🔒 קבועה
                    </span>
                  ) : (
                    <QuestionToggle id={q.id} active={q.active} />
                  )}
                </div>
                {editable && <QuestionOptionsEditor questionId={q.id} options={qOptions} />}
              </div>
            );
          })}
            </div>
          ))}
        </div>
      </div>

      {/* Taxonomies */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">רשימות וערכים</h3>
        <p className="text-[12.5px] text-ink-500 mb-4">
          טכנולוגיות, אזורים, תחומים וקטגוריות הזמינים בכל המוצר.
        </p>
        <div className="flex flex-col gap-4">
          {(["tech", "specialization", "region", "project_category", "list"] as TaxonomyKind[]).map(
            (kind) => (
              <TaxonomyManager
                key={kind}
                kind={kind}
                label={KIND_LABEL[kind]}
                items={byKind.get(kind) ?? []}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
