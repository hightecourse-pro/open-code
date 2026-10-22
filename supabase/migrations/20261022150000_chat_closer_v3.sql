-- Closer rule v3 (22/10): Hebrew prefixes glue to question words - "ומתי",
-- "ולמה", "שאפשר", "כשאיך" - so the "no question word anywhere" test allows
-- up to three prefix letters (ו ש כ ל ב מ ה) before the word. Nothing else changes.
create or replace function public.is_chat_closer(p_body text)
returns boolean
language sql
immutable
set search_path = public
as $$
  with t as (
    select trim(regexp_replace(
      regexp_replace(replace(coalesce(p_body, ''), '&nbsp;', ' '), '<[^>]+>', ' ', 'g'),
      '[[:space:]]+', ' ', 'g')) as txt
  )
  select coalesce((
    select position('?' in txt) = 0
      and txt !~ '(^|[^א-ת])[ושכלבמה]{0,3}(מתי|איך|למה|האם|איפה|כמה|אפשר|אשמח|תוכלי|תוכל|צריכה|רציתי|בבקשה)([^א-ת]|$)'
      and (
        txt ~ '^([א-ת]{1,6}[ ,!.]+)?(תודה|מעולה|סבבה|אוקי|בסדר|מצוי|יופי|מושלם|בשמחה|אין בעד מה|לילה טוב|שבת שלום|שבוע טוב|בהצלחה|מקסים|איזה כיף|כיף|נהדר|מגניב|וואו|אחלה|💜|❤|🙏|👍|😊|🥰)'
        or (length(txt) <= 120 and txt ~ '(^|[^א-ת])תודה')
        or (length(txt) <= 40 and txt ~ '(:\)|:-\)|💜|❤|🙏|👍|😊|🥰|💓|🎉|😍)[[:space:]!.]*$')
        or (length(txt) <= 12 and txt !~ '^(מה|מי |יש |אין |אולי|אפשרי|שלח|נשלח)')
      )
    from t
  ), false);
$$;
