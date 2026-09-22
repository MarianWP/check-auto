// Edge Function assistant: чат з помічником на базі Claude для питань про огляд авто.
// Приймає { message, context?, inspection_id?, lang? } від залогіненого користувача (JWT Supabase у Authorization),
// підвантажує останні репліки цієї розмови з бази, стрімить відповідь як text/plain і зберігає обидві репліки.
// Секрети: ANTHROPIC_API_KEY (обов'язково), ASSISTANT_MODEL, ASSISTANT_DAILY_LIMIT (типово 30),
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (є в середовищі функцій).
import { createClient } from "npm:@supabase/supabase-js@2";

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ASSISTANT_MODEL") || "claude-sonnet-5";
const DAILY_LIMIT = Number(Deno.env.get("ASSISTANT_DAILY_LIMIT") || 30);
const MAX_MESSAGE = 1500, MAX_CONTEXT = 8000, HISTORY = 12, MAX_TOKENS = 1024;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Expose-Headers": "x-remaining" };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra, "Content-Type": "application/json" } });

const LANGS: Record<string, string> = { uk: "українською", ru: "російською", en: "англійською" };

const SYSTEM = `Ти помічник у застосунку Golf Check: він допомагає оглянути вживане авто перед покупкою за покроковим чек-листом.
Відповідай коротко і по суті: 3–8 речень або короткий список, без вступів і без повторення запитання.
Звичайний текст: без заголовків, без зірочок і жирного, списки через тире з нового рядка.
Спирайся на дані огляду в блоці «Контекст», якщо він є: модель, двигун, коробка, рік, відповіді користувача, знайдені проблеми.
Пояснюй, як перевірити руками й очима, чим загрожує проблема і чи це привід торгуватися або відмовитися.
Ціни називай лише орієнтовно і в доларах, як діапазон. Якщо не впевнений, скажи прямо. Ти не заміняєш діагностику на СТО і не даєш юридичних гарантій.
На запитання не про авто, огляд чи покупку відповідай одним реченням, що допомагаєш лише з оглядом авто.`;

type Msg = { role: "user" | "assistant"; content: string };

function anthropicStream(messages: Msg[], system: string): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, stream: true, system, messages })
  });
}

// Розбір SSE від Anthropic: беремо лише text_delta.
function textDeltas(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const dec = new TextDecoder(); let buf = "";
  return body.pipeThrough(new TransformStream<Uint8Array, string>({
    transform(chunk, ctrl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") ctrl.enqueue(ev.delta.text);
          else if (ev.type === "error") ctrl.enqueue("\n\n[Помилка сервісу: " + (ev.error?.message ?? "невідома") + "]");
        } catch { /* неповний рядок, дочекаємося решти */ }
      }
    }
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!API_KEY) return json({ error: "ANTHROPIC_API_KEY не задано у секретах функції" }, 500);
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
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("assistant_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", since);
  const used = count ?? 0;
  if (used >= DAILY_LIMIT) return json({ error: `Ліміт ${DAILY_LIMIT} запитань на добу вичерпано. Спробуй завтра.`, remaining: 0 }, 429, { "x-remaining": "0" });
  const remaining = DAILY_LIMIT - used - 1;

  // Історія цієї розмови (той самий огляд або без огляду).
  let q = admin.from("assistant_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(HISTORY);
  q = inspectionId ? q.eq("inspection_id", inspectionId) : q.is("inspection_id", null);
  const { data: hist } = await q;
  const history: Msg[] = ((hist ?? []) as Msg[]).reverse();
  // Anthropic вимагає чергування ролей і перший хід від користувача.
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
  const up = await anthropicStream(messages, system);
  if (!up.ok || !up.body) {
    const t = await up.text().catch(() => "");
    console.error("anthropic", up.status, t.slice(0, 300));
    return json({ error: up.status === 401 ? "Ключ Claude API недійсний" : up.status === 429 ? "Сервіс перевантажено, спробуй за хвилину" : "Помічник тимчасово недоступний" }, 502);
  }

  // Стрімимо текст клієнту і паралельно збираємо повну відповідь для збереження.
  let full = "";
  const enc = new TextEncoder();
  const out = textDeltas(up.body).pipeThrough(new TransformStream<string, Uint8Array>({
    transform(t, ctrl) { full += t; ctrl.enqueue(enc.encode(t)); },
    async flush() {
      const rows = [{ user_id: userId, inspection_id: inspectionId, role: "user", content: message }];
      if (full.trim()) rows.push({ user_id: userId, inspection_id: inspectionId, role: "assistant", content: full.trim() });
      const { error } = await admin.from("assistant_messages").insert(rows);
      if (error) console.error("save", error.message);
    }
  }));
  return new Response(out, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "x-remaining": String(remaining) } });
});
