// Edge Function generate: ШІ складає картку авто і пункти чек-листа для «іншого авто» за маркою, моделлю, роком,
// двигуном і коробкою. Приймає { brand, model, year, fuel?, engine?, gear?, body? } від залогіненого користувача,
// повертає { id, def, remaining } і зберігає рядок у custom_models. Клієнт нормалізує def сам (src/logic/generated.js).
// Секрети: OPENAI_API_KEY (основний) або ANTHROPIC_API_KEY, GENERATE_MODEL (типово як ASSISTANT_MODEL або gpt-5-mini),
// GENERATE_DAILY_LIMIT (типово 10), SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const PROVIDER = OPENAI_KEY ? "openai" : ANTHROPIC_KEY ? "anthropic" : "";
const MODEL = Deno.env.get("GENERATE_MODEL") || Deno.env.get("ASSISTANT_MODEL") || (PROVIDER === "openai" ? "gpt-5-mini" : "claude-sonnet-5");
const DAILY_LIMIT = Number(Deno.env.get("GENERATE_DAILY_LIMIT") || 10);
const MAX_TOKENS = 9000;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const STAGES = "docs (документи), body (кузов), wheels (колеса і гальма), engine (двигун на холодну), start (запуск), interior (салон), electrics (електрика), chassis (підвіска і ходова), drive (тест-драйв), after (після поїздки)";

// Зрозуміле пояснення помилки провайдера: 429 в OpenAI майже завжди означає нуль коштів, а не перевантаження.
function providerError(provider: string, status: number, body: string): string {
  const who = provider === "openai" ? "OpenAI" : "Claude";
  if (/insufficient_quota|billing|exceeded your current quota/i.test(body)) return "На акаунті " + who + " немає коштів: поповни Billing на platform.openai.com і спробуй знову.";
  if (status === 401) return "Ключ " + who + " API недійсний: перевір секрет у Supabase.";
  if (status === 404 || /model_not_found|does not exist|not found/i.test(body)) return "Модель " + MODEL + " недоступна для цього ключа: зміни ASSISTANT_MODEL або GENERATE_MODEL.";
  if (status === 429) return "Забагато запитів до " + who + " одночасно, спробуй за хвилину.";
  if (status === 400) return "Провайдер відхилив запит (" + body.slice(0, 120) + ").";
  return "Помічник тимчасово недоступний (" + who + " " + status + ").";
}

const GEAR_NAMES: Record<string, string> = { manual: "механічна", at: "автоматична гідротрансформаторна", dsg: "роботизована (DSG / DCT / AMT)", cvt: "варіатор", unknown: "невідомо (обери найпоширенішу для цього авто і року)" };
const FUEL_NAMES: Record<string, string> = { petrol: "бензин", diesel: "дизель", hybrid: "гібрид", electric: "електро" };

const SYSTEM = `Ти автоексперт зі вживаних авто на ринку України. Складаєш довідкову картку авто і пункти передпродажного огляду.
Відповідай СУВОРО одним JSON-об'єктом без пояснень. Усі тексти українською, конкретні, без води. Ціни в доларах США як [від, до] для України 2026 року.
Схема JSON:
{
 "brand": string, "name": string (модель і покоління, напр. "Corolla E150"), "full": string (марка, модель, покоління, роки), "years": [рікПочатку, рікКінця] покоління,
 "body": {"name": string, "short": string (до 12 символів)},
 "market": {"avg": число (середня ціна такого авто цього покоління в Україні, $), "search": string (URL пошуку на auto.ria.com для цієї марки й моделі)},
 "price": [від, до] (ринковий діапазон саме для вказаного року, двигуна й коробки, $),
 "engine": {"name": string (об'єм, тип, потужність, напр. "1.6 MPI 110 к.с."), "codes": string (заводські коди двигуна), "hp": string, "fuel": "petrol"|"diesel"|"hybrid"|"electric",
   "tags": масив з {"belt","chain","turbo","dpf","lpg"} що стосуються двигуна, "reliability": 1-5, "lpg": "ok"|"hard"|"no",
   "timing": {"type": "belt"|"chain"|"gear"|"none", "text": string (регламент і вартість заміни)},
   "summary": string (2-4 речення про мотор), "verdict": string (1-2 речення: брати чи ні і на що дивитися),
   "issues": 5-8 об'єктів {"t": коротка назва, "d": як проявляється і як перевірити, "sev": "crit"|"major"|"minor", "cost": [від, до]}},
 "gearbox": {"name": string, "short": string, "tags": масив з {"manual","at","dsg","cvt"}, "reliability": 1-5, "summary": string, "issues": 3-5 об'єктів як у двигуна},
 "common": 8-12 хвороб цього покоління (кузов, електрика, підвіска, салон) {"t","d","cost"},
 "vin": {"rows": до 6 пар [позиції, значення] про VIN цієї марки, "places": 2-4 місця, де шукати VIN},
 "plants": до 4 {"code","name","note"} заводів, "trims": до 5 {"name","note"} комплектацій,
 "kit": 6-8 речей, які взяти на огляд саме цього авто,
 "items": 8-12 пунктів чек-листа, специфічних саме для цього авто (не загальних), {"stage": один з етапів, "t": що має бути в нормі (стверджувальна форма, до 120 символів), "how": як перевірити руками й очима, "why": чим загрожує, "sev": "crit"|"major"|"minor", "cost": [від, до]}.
Етапи для items: ${STAGES}.
Якщо точних даних про якусь конфігурацію немає, візьми найближчу типову для цієї моделі й року і скажи про це в summary.`;

function userPrompt(b: Record<string, string>) {
  return `Авто: ${b.brand} ${b.model}, рік випуску ${b.year}.` +
    (b.fuel ? ` Паливо: ${FUEL_NAMES[b.fuel] ?? b.fuel}.` : "") +
    (b.engine ? ` Двигун (зі слів користувача): ${b.engine}.` : " Двигун не вказано: обери найпоширеніший для цього року.") +
    ` Коробка: ${GEAR_NAMES[b.gear] ?? GEAR_NAMES.unknown}.` +
    (b.body ? ` Кузов: ${b.body}.` : "") +
    " Склади JSON за схемою.";
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const body: Record<string, unknown> = { model: MODEL, response_format: { type: "json_object" }, max_completion_tokens: MAX_TOKENS, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  if (/^gpt-5/.test(MODEL)) body.reasoning_effort = "low";
  const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + OPENAI_KEY }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); console.error("openai", r.status, t.slice(0, 300)); throw new Error(providerError("openai", r.status, t)); }
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}
async function callAnthropic(system: string, user: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: "user", content: user + " Відповідь: лише JSON." }] }) });
  if (!r.ok) { const t = await r.text(); console.error("anthropic", r.status, t.slice(0, 300)); throw new Error(providerError("anthropic", r.status, t)); }
  const j = await r.json();
  return (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
}
function extractJson(text: string): unknown {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("У відповіді немає JSON");
  return JSON.parse(text.slice(s, e + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!PROVIDER) return json({ error: "OPENAI_API_KEY (або ANTHROPIC_API_KEY) не задано у секретах функції" }, 500);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Потрібен вхід" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } });
  const { data: u, error: ue } = await anon.auth.getUser(token);
  if (ue || !u?.user) return json({ error: "Сесія недійсна, увійди знову" }, 401);
  const userId = u.user.id;

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return json({ error: "Некоректний запит" }, 400); }
  const s = (k: string, n: number) => String(raw[k] ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const input = { brand: s("brand", 40), model: s("model", 60), year: String(Number(raw.year) || ""), fuel: s("fuel", 12), engine: s("engine", 60), gear: s("gear", 12), body: s("body", 40) };
  const year = Number(input.year);
  if (!input.brand || !input.model || !(year >= 1990 && year <= new Date().getFullYear() + 1)) return json({ error: "Вкажи марку, модель і рік випуску" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("custom_models").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  const used = count ?? 0;
  if (used >= DAILY_LIMIT) return json({ error: `Ліміт ${DAILY_LIMIT} карток на добу вичерпано. Спробуй завтра.`, remaining: 0 }, 429);

  let def: unknown;
  let text = "";
  try { text = PROVIDER === "openai" ? await callOpenAI(SYSTEM, userPrompt(input)) : await callAnthropic(SYSTEM, userPrompt(input)); }
  catch (e) { return json({ error: (e as Error).message }, 502); }
  try { def = extractJson(text); }
  catch (e) { console.error("generate json", (e as Error).message, text.slice(0, 200)); return json({ error: "ШІ не зміг скласти картку. Спробуй ще раз або уточни дані." }, 502); }
  const d = def as Record<string, unknown>;
  if (!d || typeof d !== "object" || !d.engine) return json({ error: "ШІ повернув неповні дані, спробуй ще раз" }, 502);

  const id = "ai_" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const { error } = await admin.from("custom_models").insert({ id, user_id: userId, input, def });
  if (error) console.error("save", error.message);
  return json({ id, def, input, createdAt: Date.now(), remaining: DAILY_LIMIT - used - 1 });
});
