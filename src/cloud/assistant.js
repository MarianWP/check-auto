/* Чат з помічником: історія з бази (RLS: лише свої рядки), запитання через Edge Function assistant
   зі стрімінгом відповіді. Ключ Claude API живе тільки в секретах функції. */
import { reactive } from "vue";
import { CLOUD, CLOUD_URL, CLOUD_KEY, supabase, errText } from "./client";
import { messageFromRow } from "../logic/assistant";

export const chat = reactive({ messages: [], loadedFor: undefined, loading: false, streaming: false, error: "", remaining: null });

const key = inspId => inspId || null;

export async function loadHistory(inspId) {
  if (!CLOUD) return;
  chat.loading = true; chat.error = "";
  try {
    let q = supabase.from("assistant_messages").select("id, role, content, created_at").order("created_at", { ascending: true }).limit(60);
    q = inspId ? q.eq("inspection_id", inspId) : q.is("inspection_id", null);
    const { data, error } = await q;
    if (error) throw error;
    chat.messages = (data || []).map(messageFromRow).filter(Boolean);
    chat.loadedFor = key(inspId);
  } catch (e) { chat.error = errText(e); }
  finally { chat.loading = false; }
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
}
