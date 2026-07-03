-- ============================================================================
-- Open Code — Phase 4d: address fields (run in the SQL Editor). Safe to re-run.
-- City becomes a maintained select (+ "אחר"); adds street + house number.
-- ============================================================================

-- City → select with a maintained list + "אחר" (edit the list in Admin → קונפיגורציה)
update public.config_questions
  set field_type = 'select', required = true, intake_track = 'both',
      options = '[{"value":"jerusalem","label":"ירושלים"},{"value":"bnei_brak","label":"בני ברק"},{"value":"modiin_illit","label":"מודיעין עילית"},{"value":"beitar_illit","label":"ביתר עילית"},{"value":"beit_shemesh","label":"בית שמש"},{"value":"elad","label":"אלעד"},{"value":"ashdod","label":"אשדוד"},{"value":"ashkelon","label":"אשקלון"},{"value":"petah_tikva","label":"פתח תקווה"},{"value":"netanya","label":"נתניה"},{"value":"haifa","label":"חיפה"},{"value":"rechasim","label":"רכסים"},{"value":"tzfat","label":"צפת"},{"value":"tveria","label":"טבריה"},{"value":"kiryat_gat","label":"קרית גת"},{"value":"rehovot","label":"רחובות"},{"value":"bat_yam","label":"בת ים"},{"value":"holon","label":"חולון"},{"value":"ramat_gan","label":"רמת גן"},{"value":"givat_shmuel","label":"גבעת שמואל"},{"value":"telz_stone","label":"טלזסטון (קרית יערים)"},{"value":"emanuel","label":"עמנואל"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'city';

-- Street + house number (both tracks). Sorted right after city.
insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, intake_track, options) values
  ('street',       'רחוב', 'text', true, 16, 'junior', 'both', '[]'::jsonb),
  ('house_number', 'מספר בית', 'text', true, 17, 'junior', 'both', '[]'::jsonb)
on conflict (key) do nothing;

-- (idempotent) keep them required if the rows already existed
update public.config_questions set required = true where key in ('street', 'house_number');
