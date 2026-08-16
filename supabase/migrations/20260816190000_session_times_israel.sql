-- ============================================================================
-- Open Code — שעות סשנים לפי שעון ישראל (BUG-022).
-- Run once in the SQL Editor. Safe to re-run — הרצה שנייה לא תזיז שוב כלום.
--
-- מה קרה: טופס "הוספת סשן" שלח שעה בלי אזור זמן ("2026-08-20T19:00"), והשרת,
-- שרץ ב-UTC, שמר אותה כאילו היא UTC. סשן שהוקלד 19:00 נשמר 19:00Z והוצג
-- לחברות 22:00 שעון ישראל. הקוד כבר תוקן: מה שמקלידים הוא שעון ישראל, ומה
-- שכולן רואות הוא שעון ישראל.
--
-- מה הקובץ הזה עושה: לוקח סשנים *עתידיים בלבד* שנוצרו לפני התיקון, ומפרש מחדש
-- את השעה השמורה שלהם כשעה מקומית בישראל. בפועל זו הזזה אחורה של הקיזוז של
-- אותו תאריך — 3 שעות בשעון קיץ, שעתיים בחורף. הקיזוז נגזר לכל שורה בנפרד
-- מ-'Asia/Jerusalem'; אין כאן שום +02:00/+03:00 מקודד קשיח.
--     19:00Z (הוצג 22:00) ->  16:00Z (מוצג 19:00)  ✓
--
-- מה הוא במפורש *לא* עושה:
--   • לא נוגע בסשנים שכבר עברו (scheduled_at <= now()) — ההיסטוריה נשארת כשהיתה.
--   • לא נוגע בסשנים שנוצרו אחרי שהתיקון עלה לאוויר — הם כבר נשמרו נכון.
--     אם את מריצה את הקובץ ביום אחר מהעלייה לאוויר, עדכני את v_fix_deployed_at.
--   • לא רץ פעמיים — ההרצה נרשמת ב-public.data_fixes.
--
-- לפני ההרצה: הריצי לבד את שאילתת התצוגה המקדימה שבסוף הקובץ (SELECT בלבד,
-- לא משנה כלום) כדי לראות בדיוק אילו סשנים יזוזו ומאיזו שעה לאיזו שעה.
-- הערה: ל-sessions יש טריגר updated_at, אז השורות שיזוזו יקבלו updated_at חדש.
-- ============================================================================

-- פנקס תיקוני נתונים — כדי שהקובץ יהיה בטוח להרצה חוזרת.
create table if not exists public.data_fixes (
  name       text primary key,
  applied_at timestamptz not null default now(),
  note       text
);

-- טבלה פנימית לצוות: RLS דלוק בלי אף מדיניות, כלומר אף לקוח לא קורא אותה.
alter table public.data_fixes enable row level security;

do $$
declare
  -- הרגע שבו התיקון עלה לאוויר. סשן שנוצר אחריו כבר נשמר בשעון ישראל.
  v_fix_deployed_at constant timestamptz := '2026-08-16 00:00:00+03';
  v_rows integer := 0;
begin
  if exists (select 1 from public.data_fixes where name = 'session_times_israel') then
    raise notice 'התיקון כבר הורץ בעבר — לא שיניתי כלום.';
    return;
  end if;

  with shifted as (
    update public.sessions s
       -- קוראים את השעה השמורה כשעון קיר, ומפרשים אותה מחדש כשעה בישראל.
       set scheduled_at = (s.scheduled_at at time zone 'UTC') at time zone 'Asia/Jerusalem'
     where s.scheduled_at > now()
       and s.created_at  < v_fix_deployed_at
    returning 1
  )
  select count(*) into v_rows from shifted;

  insert into public.data_fixes (name, note)
  values ('session_times_israel', format('הוזזו %s סשנים עתידיים לשעון ישראל', v_rows));

  raise notice 'הוזזו % סשנים עתידיים לשעון ישראל. סשנים שעברו לא נגעתי בהם.', v_rows;
end $$;

-- ============================================================================
-- תצוגה מקדימה — SELECT בלבד, לא משנה כלום.
-- הריצי אותה *לפני* הקובץ: "מוצג היום" היא השעה השגויה שהחברות רואות עכשיו,
-- ו"מה שהוקלד" היא השעה שהקלדת — ובדיוק היא שתוצג אחרי ההרצה.
-- אחרי ההרצה השוו רק את "מוצג היום" למה שהתכוונת אליו (העמודה השנייה כבר לא
-- רלוונטית, כי הערך השמור השתנה).
-- ============================================================================
select
  s.title,
  to_char(s.scheduled_at at time zone 'Asia/Jerusalem', 'DD/MM/YYYY HH24:MI') as "מוצג היום",
  to_char(s.scheduled_at at time zone 'UTC',            'DD/MM/YYYY HH24:MI') as "מה שהוקלד",
  s.created_at
from public.sessions s
where s.scheduled_at > now()
order by s.scheduled_at;
