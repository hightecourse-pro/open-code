-- ============================================================================
-- קוד פתוח — no minimum commitment.
--
-- The membership no longer asks a junior to commit for three months. The term
-- was never enforced anywhere in the code — it only ever appeared as copy on
-- the marketing page and the join screen, and was recorded on the subscription
-- row — so removing it is a change of promise, not of behaviour.
--
-- Set to 0 rather than removed: getPricing() reads the field, and the join and
-- landing copy switch to "אפשר לבטל בכל עת" when it is 0.
-- ============================================================================

update public.app_settings
   set value = jsonb_set(value, '{minTermMonths}', '0'::jsonb)
 where key = 'pricing';
