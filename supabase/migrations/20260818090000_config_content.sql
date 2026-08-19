-- ============================================================================
-- קוד פתוח — profile questions and taxonomy lists.
--
-- This is CONTENT, not schema. It lived only in the database: of the 58 taxonomy
-- rows only 7 came from a migration, and two active questions (work_history,
-- live_links) existed in no repo file at all — while eight source files depend
-- on them. A database built from migrations/ alone therefore produced an intake
-- form with empty technology, region and specialisation lists.
--
-- Retired on the way: the tech values 'c#' and 'node_js', each a duplicate label
-- of a value already in use ('csharp', 'nodejs'), so members saw the same option
-- twice; and two rows created by mis-clicks in the taxonomy editor.
--
-- app_settings is deliberately not carried. Only its 'pricing' row is
-- configuration and a migration already seeds it; the other three rows are
-- webhook run-state, and importing them would show production a successful
-- payment check that never happened and mute the first rejection alert.
-- ============================================================================

-- Retire the four rows first. On a fresh database this deletes nothing; on the
-- existing one it removes the duplicates members were seeing twice. Verified
-- unused before writing this: no profile answer, job or course references them.
delete from public.config_taxonomies
 where (kind = 'tech'   and value in ('c#', 'node_js'))
    or (kind = 'region' and value = 'v3oxa6m')
    or (kind = 'list' and value = 'vxib86e');

insert into public.config_questions ("id", "key", "label_he", "field_type", "required", "sort_order", "active", "scope", "options", "created_at", "updated_at", "taxonomy_kind", "depends_on", "intake_track", "employer_visible") values
    ('890115e4-7d8d-4482-b042-07eb45c338f1', 'specialization', 'מה התחום שלך?', 'select', true, 0, true, 'all', '[{"label":"פרונטאנד","value":"frontend"},{"label":"באקאנד","value":"backend"},{"label":"פולסטאק","value":"fullstack"},{"label":"QA / בדיקות","value":"qa"},{"label":"DevOps","value":"devops"},{"label":"דאטה / AI","value":"data"},{"label":"מובייל","value":"mobile"}]'::jsonb, '2026-06-15 15:40:20.492156+00', '2026-08-17 19:34:41.133886+00', null, null, 'both', true),
    ('e351ae5a-80fe-4ac9-a096-b996cf752c47', 'has_experience', 'יש לך ניסיון אמיתי בתעשייה (מעל שנה)?', 'bool', false, 1, false, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-07-21 15:38:41.531854+00', null, null, 'both', false),
    ('6b9cd1e2-8c97-4e1c-931e-3e88fc8d1ce9', 'tech_stack', 'הטכנולוגיות שלך', 'multiselect', false, 2, false, 'all', '[{"label":"React","value":"react"},{"label":"Node.js","value":"nodejs"},{"label":"TypeScript","value":"typescript"},{"label":"Python","value":"python"},{"label":"SQL","value":"sql"},{"label":"CSS","value":"css"},{"label":"Java","value":"java"}]'::jsonb, '2026-06-15 15:40:20.492156+00', '2026-08-17 19:24:58.768548+00', null, null, 'both', true),
    ('7a67d059-b4d4-4213-8893-0854614e14c3', 'id_number', 'תעודת זהות', 'text', true, 3, true, 'all', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:24:58.883729+00', null, null, 'both', false),
    ('2d3b1ffc-a53c-43cc-848f-009849ed6479', 'phone', 'טלפון נייד', 'text', true, 4, true, 'all', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:24:59.005697+00', null, null, 'both', false),
    ('56fb41f8-bc00-4a18-bc8a-dd35a5ef4ddd', 'marital_status', 'מצב משפחתי', 'select', true, 5, true, 'all', '[{"label":"נשואה","value":"married"},{"label":"רווקה","value":"single"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:24:59.121214+00', null, null, 'both', false),
    ('40dc0678-6cac-44e2-a4d7-bad87dec8c29', 'prev_surname', 'שם משפחה קודם (אם רלוונטי)', 'text', false, 6, true, 'all', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:24:59.442152+00', null, null, 'both', false),
    ('2a665d6b-48b0-4f73-bc9d-3574a028f3df', 'city', 'עיר מגורים', 'select', true, 7, true, 'all', '[{"label":"ירושלים","value":"jerusalem"},{"label":"בני ברק","value":"bnei_brak"},{"label":"מודיעין עילית","value":"modiin_illit"},{"label":"ביתר עילית","value":"beitar_illit"},{"label":"בית שמש","value":"beit_shemesh"},{"label":"אלעד","value":"elad"},{"label":"אשדוד","value":"ashdod"},{"label":"אשקלון","value":"ashkelon"},{"label":"פתח תקווה","value":"petah_tikva"},{"label":"נתניה","value":"netanya"},{"label":"חיפה","value":"haifa"},{"label":"רכסים","value":"rechasim"},{"label":"צפת","value":"tzfat"},{"label":"טבריה","value":"tveria"},{"label":"קרית גת","value":"kiryat_gat"},{"label":"רחובות","value":"rehovot"},{"label":"בת ים","value":"bat_yam"},{"label":"חולון","value":"holon"},{"label":"רמת גן","value":"ramat_gan"},{"label":"גבעת שמואל","value":"givat_shmuel"},{"label":"טלזסטון (קרית יערים)","value":"telz_stone"},{"label":"עמנואל","value":"emanuel"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:24:59.564594+00', null, null, 'both', false),
    ('045bd4ba-1a7a-4d53-8b47-540baf65cd8b', 'street', 'רחוב', 'text', true, 8, true, 'junior', '[]'::jsonb, '2026-07-04 20:46:13.678465+00', '2026-08-17 19:24:59.681876+00', null, null, 'both', false),
    ('08c38962-8db0-4763-914b-84f9ec87891f', 'house_number', 'מספר בית', 'text', true, 9, true, 'junior', '[]'::jsonb, '2026-07-04 20:46:13.678465+00', '2026-08-17 19:24:59.798798+00', null, null, 'both', false),
    ('9e493bb4-f029-4035-9367-a2b26fa71c27', 'region', 'אזור מגורים', 'select', true, 10, true, 'all', '[{"label":"מרכז","value":"center"},{"label":"צפון","value":"north"},{"label":"דרום","value":"south"},{"label":"ירושלים והסביבה","value":"jerusalem"}]'::jsonb, '2026-06-15 15:40:20.492156+00', '2026-08-17 19:24:59.917564+00', 'region', null, 'both', true),
    ('ad627ee1-238a-4170-9e2c-49458f57b766', 'study_place', 'מוסד לימודים', 'select', true, 11, true, 'junior', '[{"label":"הרב וולף","value":"wolf"},{"label":"החדש ירושלים","value":"hadash_jlm"},{"label":"החדש ביתר","value":"hadash_beitar"},{"label":"בנות אלישבע","value":"bnot_elisheva"},{"label":"הישן ירושלים","value":"yashan_jlm"},{"label":"הישן ביתר","value":"yashan_beitar"},{"label":"כהנא","value":"kahana"},{"label":"הרב שרנסקי","value":"sharansky"},{"label":"בית המורה","value":"beit_hamore"},{"label":"סמינר רכסים","value":"rechasim"},{"label":"גור ירושלים","value":"gur_jlm"},{"label":"דרכי חנה אלעד","value":"darkei_chana_elad"},{"label":"הסניף ירושלים - דרכי רחל","value":"darkei_rachel_jlm"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:14.259684+00', null, null, 'both', true),
    ('cb77915a-478e-42fc-957a-701aa33b4432', 'track_specialization', 'התמחות ספציפית במגמה', 'multiselect', true, 12, true, 'junior', '[{"label":"בינה מלאכותית","value":"ai"},{"label":"חומרה ושבבים","value":"hardware"},{"label":"מכון לב","value":"lev"},{"label":"סייבר","value":"cyber"},{"label":"DevOps","value":"devops"},{"label":"פולסטאק","value":"fullstack"},{"label":"אוטומציה","value":"automation"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:14.409768+00', null, null, 'both', true),
    ('7de027aa-73a9-471a-a96f-42f41311eef0', 'track', 'מגמה', 'select', false, 13, false, 'junior', '[{"label":"הנדסת תוכנה","value":"software"},{"label":"מדעי המחשב","value":"cs"},{"label":"הנדסאית תוכנה","value":"practical_se"},{"label":"חשמל ואלקטרוניקה","value":"electronics"},{"label":"בדיקות תוכנה / QA","value":"qa"},{"label":"סייבר","value":"cyber"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:08.746781+00', null, null, 'both', false),
    ('d4aa5b97-5b28-4c51-8cfc-3dfba629683f', 'graduation_year', 'שנת סיום לימודים', 'select', true, 14, true, 'junior', '[{"label":"תשפ\"ו","value":"5786"},{"label":"תשפ\"ה","value":"5785"},{"label":"תשפ\"ד","value":"5784"},{"label":"תשפ\"ג","value":"5783"},{"label":"תשפ\"ב","value":"5782"},{"label":"תשפ\"א","value":"5781"},{"label":"תש\"פ","value":"5780"},{"label":"תשע\"ט","value":"5779"},{"label":"תשע\"ח","value":"5778"},{"label":"תשע\"ז","value":"5777"},{"label":"תשע\"ו","value":"5776"},{"label":"תשע\"ה","value":"5775"},{"label":"תשע\"ד","value":"5774"},{"label":"תשע\"ג","value":"5773"},{"label":"תשע\"ב","value":"5772"},{"label":"תשע\"א","value":"5771"},{"label":"תש\"ע","value":"5770"},{"label":"תשס\"ט","value":"5769"},{"label":"תשס\"ח","value":"5768"},{"label":"תשס\"ז","value":"5767"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:00.576691+00', null, null, 'both', true),
    ('588efa70-8487-4727-80f7-f65ef1d690eb', 'certificate', 'תעודה', 'multiselect', true, 15, true, 'junior', '[{"label":"הנדסאי תוכנה מה\"ט","value":"mahat"},{"label":"הנדסאי משרד החינוך","value":"moe"},{"label":"תואר","value":"degree"},{"label":"QA","value":"qa"},{"label":"יישום סיילספורס","value":"salesforce"},{"label":"תקשוב","value":"tikshuv"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:00.884013+00', null, null, 'both', true),
    ('3bd927d8-fd58-4753-8b65-409784456a78', 'coordinator_name', 'שם רכזת המגמה', 'text', false, 16, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:01.011498+00', null, null, 'both', false),
    ('1238f9f6-b698-4669-9efc-2ff96c0948aa', 'coordinator_phone', 'טלפון רכזת המגמה', 'text', false, 17, false, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:01.1277+00', null, null, 'both', false),
    ('60680a02-83d6-42bf-9f16-273b8cdb6abb', 'coordinator_email', 'מייל רכזת המגמה', 'text', false, 18, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:01.241375+00', null, null, 'both', false),
    ('36981fe4-e2a1-4ed5-b211-963a40a839ff', 'language_skills', 'שליטה בשפות', 'multiselect', true, 19, true, 'all', '[]'::jsonb, '2026-07-19 19:54:25.322736+00', '2026-08-17 19:25:01.554918+00', null, null, 'both', true),
    ('79af764e-1388-4259-b81d-9da99425de09', 'genai_known', 'טכנולוגיות GenAI שיש לך בהן ידע אמיתי', 'multiselect', false, 20, false, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:01.669693+00', 'tech', null, 'both', true),
    ('af5a1709-ef9d-4831-b9b5-2faf8dc47b52', 'ai_tools_used', 'באיזה כלי AI יצא לך להשתמש בפועל?', 'multiselect', false, 21, true, 'junior', '[{"label":"ChatGPT","value":"chatgpt"},{"label":"Claude","value":"claude"},{"label":"Gemini","value":"gemini"},{"label":"GitHub Copilot","value":"copilot"},{"label":"Cursor","value":"cursor"},{"label":"Claude Code","value":"claude_code"},{"label":"Windsurf","value":"windsurf"},{"label":"Kiro","value":"kiro"},{"label":"Amazon Q","value":"amazon_q"},{"label":"Lovable","value":"lovable"},{"label":"v0","value":"v0"},{"label":"Bolt","value":"bolt"},{"label":"Replit","value":"replit"},{"label":"NotebookLM","value":"notebooklm"},{"label":"Perplexity","value":"perplexity"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:01.785878+00', null, null, 'both', true),
    ('17847c7b-6201-412c-876a-51dd56e05eb0', 'ai_gaps', 'איזה חומר ב-AI את מרגישה שחסר לך?', 'text', false, 22, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:01.900017+00', null, null, 'junior', false),
    ('d1b9f842-46cd-4f25-a7fa-2ae71664a259', 'dev_tech', 'טכנולוגיות שלמדת', 'multiselect', true, 23, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:02.019391+00', 'tech', null, 'both', true),
    ('3324c5ac-8741-4701-9415-0c8bf32acedd', 'genai_practiced', 'טכנולוגיות GenAI שהתנסית בהן בפועל', 'multiselect', false, 24, true, 'junior', '[{"label":"OpenAI API","value":"openai_api"},{"label":"Claude API","value":"claude_api"},{"label":"Gemini API","value":"gemini_api"},{"label":"RAG","value":"rag"},{"label":"סוכנים (Agents)","value":"agents"},{"label":"MCP","value":"mcp"},{"label":"LangChain / LangGraph","value":"langchain"},{"label":"n8n / אוטומציות","value":"n8n"},{"label":"Fine-tuning","value":"fine_tuning"},{"label":"בסיסי נתונים וקטוריים","value":"vector_db"},{"label":"Prompt Engineering","value":"prompt_eng"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:02.330963+00', null, null, 'both', true),
    ('5045065d-0821-408e-bd7c-319dacac4bf3', 'ai_project_links', 'קישורים לפרויקטי AI שעשית (שורה לכל קישור)', 'text', false, 25, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:02.445255+00', null, null, 'both', true),
    ('ca12e772-240f-4c0b-a36d-1e07ce077e4a', 'github', 'קישורים ל-GitHub (שורה לכל קישור)', 'text', false, 26, true, 'all', '[]'::jsonb, '2026-06-15 15:40:20.492156+00', '2026-08-17 19:25:02.557917+00', null, null, 'both', true),
    ('915dce2e-41e4-4af6-90af-37469ad64592', 'live_links', 'קישורים לפרויקטים חיים (שורה לכל קישור)', 'text', false, 27, true, 'junior', '[]'::jsonb, '2026-08-10 11:44:29.525091+00', '2026-08-17 19:25:02.679151+00', null, null, 'both', true),
    ('04bd5ef5-2902-4a57-b07d-712342ae426a', 'practicum_done', 'עשית בוטקאמפ / פרקטיקום?', 'bool', true, 28, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:02.793446+00', null, null, 'junior', true),
    ('bc219a07-c863-4438-9f7b-d77920ee7da7', 'practicum_employer', 'איפה?', 'text', false, 29, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:02.906199+00', null, 'practicum_done', 'junior', true),
    ('c17647b9-574a-49b1-a0b4-7495330a515c', 'practicum_period', 'מתי? (חודש ושנה — התחלה וסיום)', 'text', true, 30, true, 'junior', '[]'::jsonb, '2026-08-10 12:09:35.876625+00', '2026-08-17 19:25:03.020299+00', null, 'practicum_done', 'junior', true),
    ('38d811c4-2139-4c80-9db0-2c21b827e990', 'practicum_tech', 'באילו טכנולוגיות התנסית שם?', 'multiselect', false, 31, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:03.135592+00', 'tech', 'practicum_done', 'junior', true),
    ('6b2c0549-830e-47b6-adf5-d602e20eb249', 'practicum_description', 'ספרי בקצרה מה עשית שם', 'text', false, 32, true, 'junior', '[]'::jsonb, '2026-08-10 11:44:30.114514+00', '2026-08-17 19:25:03.44174+00', null, 'practicum_done', 'junior', true),
    ('fff3defe-8081-4080-b6ee-6d9acee19ed0', 'practical_experience', 'ניסיון מעשי נוסף — כאן צריך להופיע כל מה שיש בקורות החיים שלך; זה מה שמוצג ללקוחות פוטנציאליים', 'text', false, 33, true, 'junior', '[]'::jsonb, '2026-08-10 11:44:30.33675+00', '2026-08-17 19:25:03.560273+00', null, null, 'junior', true),
    ('e7a188dd-274b-4303-807d-4f96dab1594a', 'years_experience', 'כמה שנות ניסיון אמיתי יש לך?', 'number', true, 34, true, 'junior', '[]'::jsonb, '2026-06-15 15:40:20.492156+00', '2026-08-17 19:25:03.68983+00', null, null, 'experienced', true),
    ('1f3383ee-efca-4e26-af6e-19dd53dec838', 'exp_role', 'באיזה תפקיד יש לך ניסיון?', 'multiselect', true, 35, true, 'junior', '[{"label":"מפתחת","value":"dev"},{"label":"בודקת / QA","value":"qa"},{"label":"מאפיינת / אנליסטית","value":"analyst"},{"label":"אוטומציה","value":"automation"},{"label":"DevOps","value":"devops"},{"label":"תמיכה / יישום","value":"support"},{"label":"פיתוח פולסטאק","value":"fullstack_dev"},{"label":"פיתוח פרונטאנד","value":"frontend_dev"},{"label":"פיתוח באקאנד","value":"backend_dev"},{"label":"פיתוח מובייל","value":"mobile_dev"},{"label":"דאטה / BI","value":"data_bi"},{"label":"יישום סיילספורס","value":"salesforce"},{"label":"ניהול פרויקטים","value":"project_mgmt"},{"label":"אחר","value":"other"}]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:03.806766+00', null, null, 'experienced', true),
    ('5990b9d1-08c2-430a-8995-e27feecf6439', 'currently_working', 'האם את עובדת כרגע?', 'bool', true, 36, true, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:04.121776+00', null, null, 'experienced', true),
    ('263c81ff-77a0-4646-984f-625528cc76a1', 'work_history', 'מקומות העבודה שלך — כמו בקורות החיים; זה מה שמוצג ללקוחות פוטנציאליים', 'text', true, 37, true, 'junior', '[]'::jsonb, '2026-08-10 11:44:30.9014+00', '2026-08-17 19:25:04.247484+00', null, null, 'experienced', true),
    ('fff00bb9-d684-45fc-a62e-ef24005ab8d1', 'remote_commute', 'משרה היברידית רחוקה ממגוריי — מתאים לי להתאמץ להגיע?', 'select', true, 38, true, 'junior', '[{"label":"כן, אעשה כל מאמץ","value":"yes_any"},{"label":"כן, רק אם זה פעמיים-שלוש בשבוע","value":"yes_2_3"},{"label":"לא מתאים לתנאי החיים שלי","value":"no"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:04.36499+00', null, null, 'both', true),
    ('44ede6b5-0a53-4d2a-923f-646e112c554e', 'practicum_placement', 'השמה דרך פרקטיקום (3 חודשים ללא שכר ואז קליטה) — להציע לי?', 'select', true, 39, true, 'junior', '[{"label":"לא, רק אם זו השמה מיידית אני מעוניינת","value":"immediate_only"},{"label":"כן, שווה לי לעבוד 3 חודשים בחינם אם יש השמה בסוף","value":"yes_3m"}]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:04.479464+00', null, null, 'junior', true),
    ('0d5c289e-0a44-4b72-aceb-da73c81f64dd', 'paid_placement', '💰 שימי לב: השמה דרך קוד פתוח כרוכה בתשלום של 2,500 ש"ח לאחר חתימת החוזה. האם להציע לך משרות?', 'bool', true, 40, true, 'junior', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:04.596907+00', null, null, 'both', false),
    ('0f15b401-d4e7-4354-b54d-54d39b34302a', 'exp_tech', 'באילו טכנולוגיות יש לך ניסיון אמיתי מעבודה?', 'multiselect', true, 41, false, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:04.714256+00', 'tech', null, 'experienced', true),
    ('b6e0a182-230d-4fdf-a4ed-5a87c429d1ec', 'exp_languages', 'באילו שפות יש לך ניסיון אמיתי?', 'multiselect', true, 42, false, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:05.029264+00', 'tech', null, 'experienced', true),
    ('69a8f8d2-8bc6-4977-bb04-22c68f1ce9fe', 'current_workplace', 'מקום עבודה נוכחי / אחרון', 'text', true, 43, false, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:05.143305+00', null, null, 'experienced', true),
    ('95cf7734-06d3-43df-b309-11df180fb06a', 'work_description', 'פרטי מה בדיוק עשית בעבודה', 'text', true, 44, false, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:05.457958+00', null, null, 'experienced', true),
    ('f81aaf39-cceb-49bf-940c-2004df5e3b89', 'specific_job', 'רוצה לגשת למשרה ספציפית שפרסמנו? אם כן — איזו?', 'text', false, 45, true, 'junior', '[]'::jsonb, '2026-06-23 08:27:00.975435+00', '2026-08-17 19:25:05.573231+00', null, null, 'experienced', false),
    ('6de2ae55-3adc-4067-af0b-f88868d36269', 'bio', 'קצת עליך', 'text', false, 46, true, 'all', '[]'::jsonb, '2026-06-15 15:40:20.492156+00', '2026-08-17 19:25:05.691213+00', null, null, 'both', true),
    ('c79517cc-4ebc-429e-8525-a03d7532533b', 'notes_for_us', 'יש לך משהו לומר לנו?', 'text', false, 47, true, 'all', '[]'::jsonb, '2026-06-23 05:33:24.520371+00', '2026-08-17 19:25:05.81174+00', null, null, 'both', false)
on conflict (key) do update set
  "label_he" = excluded."label_he",
  "field_type" = excluded."field_type",
  "required" = excluded."required",
  "sort_order" = excluded."sort_order",
  "active" = excluded."active",
  "scope" = excluded."scope",
  "options" = excluded."options",
  "updated_at" = excluded."updated_at",
  "taxonomy_kind" = excluded."taxonomy_kind",
  "depends_on" = excluded."depends_on",
  "intake_track" = excluded."intake_track",
  "employer_visible" = excluded."employer_visible";

insert into public.config_taxonomies ("id", "kind", "value", "label_he", "sort_order", "active", "created_at") values
    ('03feddb9-3a42-4440-a1a4-7a61a6dc31a0', 'tech', 'react', 'React', 1, true, '2026-06-15 15:40:20.492156+00'),
    ('a8693c53-73b1-4a4f-b2d9-46de6f975f3e', 'tech', 'nodejs', 'Node.js', 2, true, '2026-06-15 15:40:20.492156+00'),
    ('bd1ebfdd-a2ac-4ce7-8d4a-b5c087f36ff1', 'tech', 'typescript', 'TypeScript', 3, true, '2026-06-15 15:40:20.492156+00'),
    ('3d953df9-6ee1-4bf2-94d3-7f7b4c716366', 'tech', 'javascript', 'JavaScript', 4, true, '2026-06-15 15:40:20.492156+00'),
    ('98d0f5ce-5866-4ed7-972b-63403f5dcfe8', 'tech', 'python', 'Python', 5, true, '2026-06-15 15:40:20.492156+00'),
    ('847b7ccf-74b0-4e8a-bfae-489c74020713', 'tech', 'sql', 'SQL', 6, true, '2026-06-15 15:40:20.492156+00'),
    ('5d6b77b3-70a0-4ff3-871c-ea9d96f073ff', 'tech', 'css', 'CSS', 7, true, '2026-06-15 15:40:20.492156+00'),
    ('136ccacc-cdb1-4c50-a0b9-1b98372919a8', 'tech', 'java', 'Java', 8, true, '2026-06-15 15:40:20.492156+00'),
    ('6545ce0e-a89b-442a-87f8-d2336c90e7db', 'tech', 'csharp', 'C#', 9, true, '2026-06-15 15:40:20.492156+00'),
    ('2ae47693-0f47-4028-891c-5b3b5607b10a', 'tech', 'go', 'Go', 10, true, '2026-06-15 15:40:20.492156+00'),
    ('22db4b62-9d1b-4d63-878b-6b0d81b490dd', 'tech', 'angular', 'Angular', 100, true, '2026-08-10 11:44:19.749578+00'),
    ('31f1b1cf-a1f5-4ec8-ab56-b6e223664536', 'tech', 'vue', 'Vue', 101, true, '2026-08-10 11:44:20.091074+00'),
    ('1b512e9f-6123-4aa6-877b-aa18e53aadbd', 'tech', 'next_js', 'Next.js', 102, true, '2026-08-10 11:44:20.258812+00'),
    ('f8ad97d4-50d7-4ec2-9b29-57bab37ef211', 'tech', 'html', 'HTML', 103, true, '2026-08-10 11:44:20.583569+00'),
    ('b8333339-1505-47fb-affb-054aa89f2eca', 'tech', 'net', '.NET', 106, true, '2026-08-10 11:44:21.329115+00'),
    ('7915d898-e3a2-4dd8-b293-9515ef9514d3', 'tech', 'php', 'PHP', 107, true, '2026-08-10 11:44:21.636844+00'),
    ('e7d8d427-5ccf-48b4-963b-39af42110acb', 'tech', 'c++', 'C++', 108, true, '2026-08-10 11:44:21.751995+00'),
    ('263bc888-ad54-4b1f-8531-230c96edaed5', 'tech', 'postgresql', 'PostgreSQL', 109, true, '2026-08-10 11:44:22.057969+00'),
    ('b3e5106a-7193-451f-b4d0-b7e145601e32', 'tech', 'mongodb', 'MongoDB', 110, true, '2026-08-10 11:44:22.367455+00'),
    ('e304d21b-2a10-438d-9911-f2079e07378a', 'tech', 'mysql', 'MySQL', 111, true, '2026-08-10 11:44:22.680836+00'),
    ('4fbdceec-0f7f-47de-86dc-19550588c700', 'tech', 'redis', 'Redis', 112, true, '2026-08-10 11:44:22.989816+00'),
    ('1f4a5c1a-9c4f-4c9e-9aa0-e99c32df53f8', 'tech', 'docker', 'Docker', 113, true, '2026-08-10 11:44:23.297499+00'),
    ('e6f6174c-80d7-4d3f-911d-621e923a65e2', 'tech', 'kubernetes', 'Kubernetes', 114, true, '2026-08-10 11:44:23.604403+00'),
    ('604ee292-b0ae-4503-9790-4c2aeed2a9c7', 'tech', 'aws', 'AWS', 115, true, '2026-08-10 11:44:23.71615+00'),
    ('0bfd81d5-e4a5-431a-9afc-875a7914447e', 'tech', 'azure', 'Azure', 116, true, '2026-08-10 11:44:24.02195+00'),
    ('fd416f2b-38df-4a69-bd7d-e25a0fb528bc', 'tech', 'git', 'Git', 117, true, '2026-08-10 11:44:24.133451+00'),
    ('c35fb18b-073d-4421-a8f7-29645b98aff9', 'tech', 'playwright', 'Playwright', 118, true, '2026-08-10 11:44:24.257584+00'),
    ('8aa536e2-8959-4587-9a3c-20bde2f2fc48', 'tech', 'selenium', 'Selenium', 119, true, '2026-08-10 11:44:24.368501+00'),
    ('04b20500-081d-404b-8fd0-f6a39f444af8', 'tech', 'cypress', 'Cypress', 120, true, '2026-08-10 11:44:24.480789+00'),
    ('05b81a5a-d561-4458-a3d5-f2fca3505abc', 'tech', 'jmeter', 'JMeter', 121, true, '2026-08-10 11:44:24.590575+00'),
    ('38fab6e7-0d6b-40f3-8f90-541dd46ab513', 'tech', 'postman', 'Postman', 122, true, '2026-08-10 11:44:24.701822+00'),
    ('32b447ee-e357-4819-992e-b1a18e90e330', 'tech', 'salesforce', 'Salesforce', 123, true, '2026-08-10 11:44:24.816271+00'),
    ('864fd8d8-36b2-4a15-83e8-49f295e0ec98', 'tech', 'flutter', 'Flutter', 124, true, '2026-08-10 11:44:24.928533+00'),
    ('e414b9a4-1421-465c-a5f7-c3773ff4e296', 'tech', 'react_native', 'React Native', 125, true, '2026-08-10 11:44:25.232098+00'),
    ('95136757-4047-4c47-9bb6-bb2c84664a86', 'tech', 'kotlin', 'Kotlin', 126, true, '2026-08-10 11:44:25.353484+00'),
    ('0c6fcb7f-721e-4f5d-9987-65132e059901', 'tech', 'swift', 'Swift', 127, true, '2026-08-10 11:44:25.667623+00'),
    ('1c668103-fbf2-41f9-bfd0-08a73e1508b5', 'project_category', 'web', 'אתרים ואפליקציות web', 1, true, '2026-06-15 15:40:20.492156+00'),
    ('5e41a2bc-5c79-48da-9c19-3bcd139bcf51', 'project_category', 'mobile', 'אפליקציות מובייל', 2, true, '2026-06-15 15:40:20.492156+00'),
    ('82698799-e727-4558-b514-53400f47309c', 'project_category', 'data', 'דאטה ובינה מלאכותית', 3, true, '2026-06-15 15:40:20.492156+00'),
    ('e2c1ebdb-579e-432e-97dd-6cccebfaf99e', 'project_category', 'infra', 'תשתיות ו-DevOps', 4, true, '2026-06-15 15:40:20.492156+00'),
    ('dfb28675-67ae-4c4f-b9fa-c1cd418213e8', 'region', 'center', 'מרכז', 1, true, '2026-06-15 15:40:20.492156+00'),
    ('53d26508-ca3c-45e9-bcd6-55bced496c02', 'region', 'north', 'צפון', 2, true, '2026-06-15 15:40:20.492156+00'),
    ('44c1c19b-34d6-4a99-a433-dc1214626c39', 'region', 'south', 'דרום', 3, true, '2026-06-15 15:40:20.492156+00'),
    ('ca3e1731-f837-4a03-8704-6cc41b1f9bab', 'region', 'jerusalem', 'ירושלים והסביבה', 4, true, '2026-06-15 15:40:20.492156+00'),
    ('9e1538b0-9439-4dec-8742-a208518a3192', 'region', 'sharon', 'השרון', 5, false, '2026-06-15 15:40:20.492156+00'),
    ('d1459c20-5c8b-4607-abea-b1124f698cb3', 'region', 'shfela', 'השפלה', 6, false, '2026-06-15 15:40:20.492156+00'),
    ('26537516-683b-4497-8eb8-4692dc1ec5c7', 'region', 'remote', 'עבודה מרחוק', 7, false, '2026-06-15 15:40:20.492156+00'),
    ('94d404dc-c4d3-4dbf-9a70-cd7da72d2a3c', 'specialization', 'frontend', 'פרונטאנד', 1, true, '2026-06-15 15:40:20.492156+00'),
    ('167ad7d2-faa6-42ec-8eef-c1ba75ad3a69', 'specialization', 'backend', 'באקאנד', 2, true, '2026-06-15 15:40:20.492156+00'),
    ('297daa68-c2dd-4ac8-87f3-4a0d4cd773e2', 'specialization', 'fullstack', 'פולסטאק', 3, true, '2026-06-15 15:40:20.492156+00'),
    ('0c181574-117d-4af0-a3d2-b46a068273fd', 'specialization', 'qa', 'QA / בדיקות', 4, true, '2026-06-15 15:40:20.492156+00'),
    ('49345c26-070d-4d93-bc57-0413b9aa5efd', 'specialization', 'devops', 'DevOps', 5, true, '2026-06-15 15:40:20.492156+00'),
    ('27e906e4-bc4e-44af-b05d-e6fe763ec31d', 'specialization', 'data', 'דאטה / AI', 6, true, '2026-06-15 15:40:20.492156+00'),
    ('f9ae6ea7-40db-48f2-b3f0-401f3e49ebd9', 'specialization', 'mobile', 'מובייל', 7, true, '2026-06-15 15:40:20.492156+00')
on conflict (kind, value) do update set
  "label_he" = excluded."label_he",
  "sort_order" = excluded."sort_order",
  "active" = excluded."active";
