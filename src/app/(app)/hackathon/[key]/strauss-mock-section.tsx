import { STRAUSS_MOCK as M } from "@/app/hackathon-2026/strauss-mock";

const n = (v: number) => v.toLocaleString("en-US");

/**
 * The Strauss challenge's fictitious data, on the page itself (the owner,
 * 12/10: "צריך שכל הפרטים יהיו גם בקהילה בדף האתגר"): our assumed answers
 * to the five questions the partner has not answered, the rules, the car
 * catalogue (real tax-authority codes and value of use), the occupations,
 * the six sample employees and their reference net. Same facts as the
 * downloadable pack - generated from one source (tools/strauss-mock.mjs).
 */
export function StraussMockSection() {
  const th = "text-start font-bold text-[12px] text-brand-purple-deep bg-tint-purple/50 px-2.5 py-1.5 first:rounded-s-lg last:rounded-e-lg whitespace-nowrap";
  const td = "px-2.5 py-1.5 text-[12.5px] text-ink-800 align-top border-b border-ink-100";
  return (
    <section className="bg-white border-2 border-ink-900/10 shadow-[3px_4px_0_0_#F3C6DD] p-5 flex flex-col gap-5" style={{ borderRadius: "22px 16px 24px 18px" }}>
      <div>
        <div className="font-mono text-[13px] text-brand-pink-deep">{"// נתוני האתגר"}</div>
        <p className="t-body-sm text-ink-800 mt-1">
          אלה הנתונים שהבוט שלכן עובד איתם: הכללים, קטלוג הרכבים, העיסוקים ושישה עובדים לדוגמה - הכול כאן וגם להורדה (אקסל + קובץ כללים JSON).
          הנתונים פיקטיביים, חוץ מקודי התוצר/הדגם ושווי השימוש שנלקחו מהמאגר של רשות המסים. המנוע שלכן קורא אותם מקובץ, כך שבפיילוט מחליפים נתונים ולא קוד.
        </p>
      </div>

      {/* the five answers */}
      <div className="flex flex-col gap-2">
        {M.answers.map((x, i) => (
          <div key={x.q} className="flex items-start gap-3 rounded-[14px] bg-tint-purple/30 px-3.5 py-2.5">
            <span className="w-6 h-6 shrink-0 rounded-full bg-brand-gradient text-white text-[12px] font-black flex items-center justify-center">{i + 1}</span>
            <div className="min-w-0">
              <div className="font-bold text-[13.5px] text-ink-1000">{x.q}</div>
              <div className="text-[13px] text-ink-800 leading-relaxed">{x.a}</div>
            </div>
          </div>
        ))}
      </div>

      {/* rules at a glance */}
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        {Object.entries(M.budgets).map(([g, b]) => (
          <span key={g} className="rounded-full border border-ink-200 bg-white px-3 py-1">
            קבוצה {g}: תקציב {n(b)} ₪
          </span>
        ))}
        <span className="rounded-full border border-ink-200 bg-white px-3 py-1">
          מסלול משפחתי: {M.familyTrack.priceNote} · {M.familyTrack.minChildren}+ ילדים עד {M.familyTrack.childMaxAge} · הפער 50/50
        </span>
        <span className="rounded-full border border-ink-200 bg-white px-3 py-1">רכב חשמלי: +{M.electricNetBonus} ₪ נטו (מגולם)</span>
      </div>

      {/* catalogue */}
      <div>
        <h3 className="font-display text-[15px] font-black text-ink-1000">קטלוג הרכבים ({M.catalogue.length})</h3>
        <div className="overflow-x-auto mt-1.5">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {["קבוצה", "תוצר", "דגם", "קוד תוצר / דגם", "שנה", "הנעה", "מחירון", "שווי שימוש", "עלות לחברה", "השתתפות"].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {M.catalogue.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} font-bold`}>{c.group}</td>
                  <td className={td}>{c.maker}</td>
                  <td className={`${td} font-bold`} dir="ltr">{c.model}</td>
                  <td className={td} dir="ltr">{c.codes}</td>
                  <td className={td}>{c.year}</td>
                  <td className={td}>{c.drive}</td>
                  <td className={td}>{n(c.listPrice)}</td>
                  <td className={td}>{n(c.valueOfUse)}</td>
                  <td className={td}>{n(c.cost)}</td>
                  <td className={td}>{n(c.participation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-500 mt-1.5">
          עמודת ההנעה במאגר (״1-חשמלי.2-היברידי.3-פלג-אין״) מקודדת בפועל: 0 בנזין · 1 היברידי · 2 פלאג-אין · 3 חשמלי. בדקו בעצמכן לפני שמסתמכות.
        </p>
      </div>

      {/* occupations */}
      <div>
        <h3 className="font-display text-[15px] font-black text-ink-1000">טבלת העיסוקים ({M.occupations.length})</h3>
        <div className="overflow-x-auto mt-1.5">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {["עיסוק", "קבוצה", "רכב חובה", "מותר לוותר", "אחזקת רכב בוויתור"].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {M.occupations.map((o) => (
                <tr key={o.title}>
                  <td className={`${td} font-bold`}>{o.title}</td>
                  <td className={td}>{o.group}</td>
                  <td className={td}>{o.mandatory ? "כן" : "לא"}</td>
                  <td className={td}>{o.waiver ? "כן" : "לא"}</td>
                  <td className={td}>{o.maintenance ? `${n(o.maintenance)} ₪` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* employees */}
      <div>
        <h3 className="font-display text-[15px] font-black text-ink-1000">שישה עובדים פיקטיביים</h3>
        <div className="overflow-x-auto mt-1.5">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {["שם", "עיסוק", "קבוצה", "בסיס", "עמלות / בונוס", "פנסיה", "קה״ש", "נק׳ זיכוי", "ילדים", "רכב היום"].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {M.employees.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} font-bold`}>{e.name}</td>
                  <td className={td}>{e.occupation}</td>
                  <td className={td}>{e.group}</td>
                  <td className={td}>{n(e.base)}</td>
                  <td className={td}>{n(e.commission)} / {n(e.bonus)}</td>
                  <td className={td}>{e.pensionPct}%</td>
                  <td className={td}>{e.studyFundPct}%</td>
                  <td className={td}>{e.creditPoints}</td>
                  <td className={td}>{e.children}</td>
                  <td className={td}>{e.today}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* reference nets */}
      <div>
        <h3 className="font-display text-[15px] font-black text-ink-1000">נטו ייחוס: היום מול החלופה</h3>
        <p className="text-[12.5px] text-ink-500 mt-0.5">חישוב להמחשה (לוחות 2025) - המנוע שלכן הוא המקור. הפירוט המלא בגיליון ״חישובים״ באקסל.</p>
        <ul className="mt-2 flex flex-col gap-2">
          {M.examples.map((x) => (
            <li key={x.id} className="rounded-[14px] border border-ink-200 px-3.5 py-2.5">
              <div className="font-bold text-[13.5px] text-ink-1000">{x.name}: {M.employees.find((e) => e.id === x.id)?.question}</div>
              <div className="text-[13px] text-ink-800 mt-0.5" dir="rtl">
                היום: {x.today} → נטו {n(x.netToday)} ₪ · החלופה: {x.alt} →{" "}
                {x.eligible ? (
                  <>
                    נטו {n(x.netAlt)} ₪ · הפרש{" "}
                    <b className={x.diff >= 0 ? "text-[#1B7A4B]" : "text-[#B42318]"}>
                      {x.diff >= 0 ? "+" : ""}
                      {n(x.diff)} ₪
                    </b>
                  </>
                ) : (
                  <b className="text-[#B42318]">לא זכאי/ת</b>
                )}
              </div>
              <div className="text-[12px] text-ink-500 mt-0.5">
                {x.reason}
                {x.eligible && x.why ? ` · ${x.why}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
