/* Чат з помічником: історія з бази (RLS: лише свої рядки), запитання через Edge Function assistant
   зі стрімінгом відповіді. Ключ API живе тільки в секретах функції.
   Історія кешується локально (golfcheck.chat.v1): при відкритті показується одразу, а хмара оновлює її у фоні. */
import { reactive } from "vue";
import { CLOUD, CLOUD_URL, CLOUD_KEY, supabase, errText } from "./client";
import { messageFromRow, readChatCache, putChatCache, CHAT_CACHE_KEY } from "../logic/assistant";

export const chat = reactive({ messages: [], loadedFor: undefined, loading: false, refreshing: false, streaming: false, error: "", remaining: null, stale: false });
const HISTORY_TIMEOUT = 10000;
let loadSeq = 0;

const key = inspId => inspId || null;
const ckey = inspId => inspId || "none";
const cacheRead = () => { try { return readChatCache(localStorage.getItem(CHAT_CACHE_KEY)); } catch (e) { return {}; } };
const cacheWrite = (inspId, list) => { try { localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(putChatCache(cacheRead(), ckey(inspId), list))); } catch (e) { /* немає місця або доступу */ } };

export async function loadHistory(inspId) {
  if (!CLOUD) return;
  const seq = ++loadSeq;
  const cached = cacheRead()[ckey(inspId)];
  chat.error = ""; chat.stale = false; chat.loadedFor = key(inspId);
  /* Кеш є — показуємо одразу і лише оновлюємо; кешу немає — чесний стан завантаження. */
  if (cached && cached.length) { chat.messages = cached; chat.loading = false; chat.refreshing = true; }
  else { chat.messages = []; chat.loading = true; }
  try {
    let q = supabase.from("assistant_messages").select("id, role, content, created_at").order("created_at", { ascending: true }).limit(60).abortSignal(AbortSignal.timeout(HISTORY_TIMEOUT));
    q = inspId ? q.eq("inspection_id", inspId) : q.is("inspection_id", null);
    const { data, error } = await q;
    if (error) throw error;
    /* Поки чекали, користувач міг перемкнути огляд: не затираємо іншу розмову. */
    if (seq !== loadSeq) return;
    const list = (data || []).map(messageFromRow).filter(Boolean);
    chat.messages = list;
    cacheWrite(inspId, list);
  } catch (e) {
    if (seq !== loadSeq) return;
    if (cached && cached.length) chat.stale = true;
    else chat.error = /abort|timeout/i.test(String(e && (e.name || e.message))) ? "Хмара відповідає надто довго. Перевір інтернет і спробуй ще раз." : errText(e);
  } finally { if (seq === loadSeq) { chat.loading = false; chat.refreshing = false; } }
}

/* Надсилає запитання; відповідь домальовується у chat.messages у міру надходження. Повертає true, якщо вдалося. */
export async function ask(text, { inspId, context, lang } = {}) {
  text = String(text || "").trim();
  if (!CLOUD || !text || chat.streaming) return false;
  const { data: s } = await supabase.auth.getSession();
  const token = s && s.session && s.session.access_token;
  if (!token) { chat.error = "Потрібен вхід через Telegram"; return false; }
  /* reactive(), а не сирі об'єкти: стрімінг дописує content, і екран має це бачити. */
  const mine = reactive({ id: "u" + Date.now(), role: "user", content: text, at: Date.now() });
  const reply = reactive({ id: "a" + Date.now(), role: "assistant", content: "", at: Date.now(), pending: true });
  chat.messages.push(mine, reply);
  chat.streaming = true; chat.error = "";
  try {
    const res = await fetch(CLOUD_URL + "/functions/v1/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CLOUD_KEY, Authorization: "Bearer " + token },
      body: JSON.stringify({ message: text, context: context || "", inspection_id: key(inspId), lang: lang || "uk" })
    });
    const rem = res.headers.get("x-remaining");
    if (rem !== null) chat.remaining = Number(rem);
    if (!res.ok) {
      let msg = "Помічник недоступний (" + res.status + ")";
      try { const j = await res.json(); if (j && j.error) msg = j.error; if (j && typeof j.remaining === "number") chat.remaining = j.remaining; } catch (e) { /* не JSON */ }
      throw new Error(msg);
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      reply.content += dec.decode(value, { stream: true });
    }
    reply.content = reply.content.trim();
    if (!reply.content) throw new Error("Порожня відповідь, спробуй ще раз");
    cacheWrite(inspId, chat.messages.map(m => ({ id: m.id, role: m.role, content: m.content, at: m.at })));
    return true;
  } catch (e) {
    chat.error = e && e.message ? e.message : errText(e);
    chat.messages = chat.messages.filter(m => m.id !== reply.id && m.id !== mine.id);
    return false;
  } finally {
    reply.pending = false;
    chat.streaming = false;
  }
}

export async function clearHistory(inspId) {
  if (!CLOUD) return;
  let q = supabase.from("assistant_messages").delete();
  q = inspId ? q.eq("inspection_id", inspId) : q.is("inspection_id", null);
  const { error } = await q;
  if (error) { chat.error = errText(error); return; }
  chat.messages = [];
  cacheWrite(inspId, []);
}
