// Edge Function assistant: чат з помічником (GPT від OpenAI; Claude як запасний провайдер) для питань про огляд авто.
// Приймає { message, context?, inspection_id?, lang? } від залогіненого користувача (JWT Supabase у Authorization),
// підвантажує останні репліки цієї розмови з бази, стрімить відповідь як text/plain і зберігає обидві репліки.
// Секрети: OPENAI_API_KEY (основний) або ANTHROPIC_API_KEY (запасний; провайдер обирається за наявним ключем),
// ASSISTANT_MODEL (типово gpt-5 для OpenAI, claude-sonnet-5 для Anthropic), ASSISTANT_DAILY_LIMIT (типово 30),
// ASSISTANT_REASONING (глибина роздумів моделей GPT-5/o: minimal | low | medium | high, типово low),
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (є в середовищі функцій).
import { createClient } from "npm:@supabase/supabase-js@2";
import { cutByLimit, emptyReplyError, firstText, isReasoningModel, openaiBody, sseEvents, type Ev } from "../_shared/llm.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const PROVIDER = OPENAI_KEY ? "openai" : ANTHROPIC_KEY ? "anthropic" : "";
const MODEL = Deno.env.get("ASSISTANT_MODEL") || (PROVIDER === "openai" ? "gpt-5" : "claude-sonnet-5");
const DAILY_LIMIT = Number(Deno.env.get("ASSISTANT_DAILY_LIMIT") || 30);
const REASONING = Deno.env.get("ASSISTANT_REASONING") || "low";
const MAX_MESSAGE = 1500, MAX_CONTEXT = 12000, HISTORY = 12, MAX_TOKENS = 1600;
// Моделі з роздумами витрачають ліміт і на роздуми, і на текст: тримаємо запас, щоб на відповідь завжди лишалося.
const BUDGET = PROVIDER === "openai" && isReasoningModel(MODEL) ? 6000 : MAX_TOKENS;
// Повтор після порожньої відповіді — лише якщо перша спроба не з'їла забагато часу (ліміт роботи функції ~150 с).
const RETRY_WITHIN_MS = 45000;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Expose-Headers": "x-remaining" };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra, "Content-Type": "application/json" } });

const LANGS: Record<string, string> = { uk: "українською", ru: "російською", en: "англійською" };

const SYSTEM = `Ти досвідчений автомеханік і підбирач вживаних авто в Україні. Працюєш у застосунку Golf Check: користувач оглядає конкретне авто перед покупкою за чек-листом, і ти відповідаєш на його запитання прямо на майданчику.

Як відповідати:
- Спершу пряма відповідь на запитання, потім конкретика. Без вступів, без повторення запитання, без загальних фраз на кшталт «зверніться до фахівця».
- Прив'язуйся до контексту: називай саме цей двигун (код, роки), коробку, рік, знайдені проблеми і коментарі користувача. Якщо в контексті є відповіді користувача, враховуй їх і не радь перевіряти те, що він уже перевірив.
- Давай перевірку руками й очима: що саме зробити, де дивитися, що є нормою, а що ні (цифри: люфт, температура, оберти, ресурс у тис. км).
- Кажи прямо, наскільки це серйозно: дрібниця, привід торгуватися (з орієнтовною сумою в доларах) чи привід відмовитися.
- Якщо питання про ціну, називай діапазон у доларах і від чого він залежить; якщо про торг, дай аргументи для розмови з продавцем.
- Якщо даних замало, спершу дай найкращу відповідь за наявними даними, а потім спитай одне уточнення.
- Обсяг: зазвичай 5–10 речень; для розгорнутого «як перевірити» можна більше. Списки через тире з нового рядка. Без заголовків, зірочок і жирного.
- На питання зовсім не про авто, огляд чи покупку відповідай одним реченням, що допомагаєш лише з оглядом авто.
Ти не заміняєш діагностику на СТО і не даєш гарантій, але не ховай за цим конкретну пораду.`;

type Msg = { role: "user" | "assistant"; content: string };

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

// OpenAI Chat Completions зі стрімінгом. Для моделей GPT-5 ліміт задається як max_completion_tokens,
// а глибина роздумів — reasoning_effort (без нього модель думає «medium» і може не встигнути написати відповідь).
function openaiStream(messages: Msg[], system: string, budget: number): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(120000),
    headers: { "content-type": "application/json", authorization: "Bearer " + OPENAI_KEY },
    body: JSON.stringify(openaiBody(MODEL, system, messages, { budget, effort: REASONING }))
  });
}
function anthropicStream(messages: Msg[], system: string, budget: number): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: AbortSignal.timeout(120000),
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: budget, stream: true, system, messages })
  });
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

  let body: { message?: unknown; context?: unknown; inspection_id?: unknown; lang?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Некоректний запит" }, 400); }
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);
  const context = String(body.context ?? "").trim().slice(0, MAX_CONTEXT);
  const inspectionId = body.inspection_id ? String(body.inspection_id).slice(0, 40) : null;
  const lang = LANGS[String(body.lang ?? "uk")] ? String(body.lang) : "uk";
  if (!message) return json({ error: "Порожнє повідомлення" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Ліміт на добу: рахуємо репліки користувача за останні 24 години.
  const { data: quota, error: quotaError } = await admin.rpc("reserve_ai_usage", { p_user: userId, p_kind: "assistant", p_limit: DAILY_LIMIT });
  if (quotaError || !quota) return json({ error: "Не вдалося перевірити ліміт. Спробуй пізніше." }, 503);
  if (!quota.allowed) return json({ error: "Денний ліміт вичерпано. Спробуй пізніше.", remaining: 0 }, 429);
  const remaining = quota.remaining;

  let q = admin.from("assistant_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(HISTORY);
  q = inspectionId ? q.eq("inspection_id", inspectionId) : q.is("inspection_id", null);
  const { data: hist } = await q;
  const history: Msg[] = ((hist ?? []) as Msg[]).reverse();
  // Чергування ролей і перший хід від користувача: так вимагає Anthropic, а OpenAI це не заважає.
  const messages: Msg[] = [];
  for (const m of history) {
    if (messages.length === 0 && m.role !== "user") continue;
    if (messages.length && messages[messages.length - 1].role === m.role) messages[messages.length - 1].content += "\n" + m.content;
    else messages.push({ role: m.role, content: m.content });
  }
  if (messages.length && messages[messages.length - 1].role === "user") messages[messages.length - 1].content += "\n" + message;
  else messages.push({ role: "user", content: message });

  let system = SYSTEM + "\nМова відповіді: " + LANGS[lang] + ".";
  if (context) system += "\n\nКонтекст поточного огляду:\n" + context;
  // Відповідь клієнту віддаємо лише після першого слова моделі. Порожній потік (ліміт пішов на роздуми, збій)
  // повторюємо один раз із подвійним запасом токенів; якщо й тоді порожньо — зрозуміла помилка, а не порожня репліка.
  const started = Date.now();
  let events: AsyncGenerator<Ev> | null = null, first = "", reason = "";
  for (const budget of [BUDGET, BUDGET * 2]) {
    let up: Response;
    try { up = await (PROVIDER === "openai" ? openaiStream(messages, system, budget) : anthropicStream(messages, system, budget)); }
    catch { return json({ error: "Помічник не відповів вчасно. Спробуй ще раз." }, 504); }
    if (!up.ok || !up.body) {
      const t = await up.text().catch(() => "");
      console.error(PROVIDER, up.status, t.slice(0, 300));
      return json({ error: providerError(PROVIDER, up.status, t) }, 502);
    }
    const stream = sseEvents(up.body);
    let r: { first: string } | { empty: string };
    try { r = await firstText(stream); }
    catch { return json({ error: "Помічник не відповів вчасно. Спробуй ще раз." }, 504); }
    if ("first" in r) { events = stream; first = r.first; break; }
    reason = r.empty;
    console.error("empty reply", MODEL, "budget", budget, "reason", reason);
    if ((!cutByLimit(reason) && !reason.startsWith("error: ")) || Date.now() - started > RETRY_WITHIN_MS) break;
  }
  // Порожній обмін не зберігаємо: інакше в історії лишилося б запитання без відповіді.
  if (!events) return json({ error: emptyReplyError(reason), remaining }, 502);

  // Стрімимо текст клієнту і паралельно збираємо повну відповідь для збереження.
  const enc = new TextEncoder();
  const src = events;
  let full = first, sent = false;
  const out = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (!sent) { sent = true; ctrl.enqueue(enc.encode(first)); return; }
      let step: IteratorResult<Ev>;
      try { step = await src.next(); }
      catch (e) { console.error("stream", String(e)); ctrl.error(new Error("Відповідь перервалася")); return; }
      if (step.done) {
        const rows = [{ user_id: userId, inspection_id: inspectionId, role: "user", content: message },
          { user_id: userId, inspection_id: inspectionId, role: "assistant", content: full.trim() }];
        const { error } = await admin.from("assistant_messages").insert(rows);
        if (error) { console.error("save", error.message); ctrl.error(new Error("Не вдалося зберегти розмову")); return; }
        ctrl.close();
        return;
      }
      const ev = step.value;
      let t = ev.text ?? "";
      if (ev.error) t += "\n\n[Помилка сервісу: " + ev.error + "]";
      else if (ev.finish && cutByLimit(ev.finish)) t += "…";
      if (t) { full += t; ctrl.enqueue(enc.encode(t)); }
    },
    async cancel() { await src.return(undefined); }
  });
  return new Response(out, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "x-remaining": String(remaining) } });
});
