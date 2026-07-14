import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { QuestionToggle } from "@/components/patterns/question-toggle";
import { TaxonomyManager } from "@/components/patterns/taxonomy-manager";
import { QuestionOptionsEditor } from "@/components/patterns/question-options-editor";
import { PricingForm } from "@/components/patterns/pricing-form";
import { getPricing } from "@/lib/payments/pricing";
import { buildPlans, shekels } from "@/lib/payments/plans";
import type { ConfigTaxonomy, FieldType, TaxonomyKind } from "@/types/database";

export const metadata: Metadata = { title: "קונפיגורציה" };

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

  const [{ data: questions }, { data: taxonomies }, pricing] = await Promise.all([
    supabase.from("config_questions").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("config_taxonomies")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    getPricing(),
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
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">קונפיגורציה</h1>
        <p className="t-body-sm text-ink-500">
          כל שינוי כאן משתקף מיד בפרופיל של החברות — בלי לגעת בקוד.
        </p>
      </div>

      {/* Membership pricing */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">דמי חבר</h3>
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
          <div>
            <span className="text-ink-500">שנתי: </span>
            <span className="font-display font-bold text-ink-1000" dir="ltr">
              {shekels(plans.annual.amountAgorot)} ₪
            </span>
          </div>
        </div>
      </div>

      {/* Profile questions */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">שאלות הפרופיל</h3>
        <p className="text-[12.5px] text-ink-500 mb-4">
          השאלות שחברות ממלאות בפרופיל. כבי כדי להסתיר מבלי למחוק.
        </p>
        <div className="flex flex-col">
          {(questions ?? []).map((q) => {
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
                    <div className="text-xs text-ink-500 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{q.key}</span>
                      <Badge variant="purple">{FIELD_LABEL[q.field_type]}</Badge>
                      {q.required && <Badge variant="pink">חובה</Badge>}
                      {q.taxonomy_kind && <Badge variant="tech">רשימה: {KIND_LABEL[q.taxonomy_kind]}</Badge>}
                      {q.key === "city" && <Badge variant="mint">רשימת ערים מ-gov.il</Badge>}
                      {locked && <Badge variant="tech">מובנה · חובה</Badge>}
                      {q.scope !== "all" && (
                        <Badge variant="indigo">{q.scope === "mentor" ? "מנטוריות" : "ג'וניוריות"}</Badge>
                      )}
                    </div>
                  </div>
                  {locked ? (
                    <span className="text-[11px] text-ink-400 flex items-center gap-1">🔒 קבוע</span>
                  ) : (
                    <QuestionToggle id={q.id} active={q.active} />
                  )}
                </div>
                {editable && <QuestionOptionsEditor questionId={q.id} options={qOptions} />}
              </div>
            );
          })}
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
