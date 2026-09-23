/* Account-scoped chat. A request may mutate only the conversation it started in. */
import { reactive, watch } from "vue";
import { CLOUD, CLOUD_URL, CLOUD_KEY, supabase, errText } from "./client";
import { user } from "./auth";
import { messageFromRow, readChatCache, putChatCache, CHAT_CACHE_KEY } from "../logic/assistant";

const empty = () => ({ messages: [], loadedFor: undefined, loading: false, refreshing: false, streaming: false,
  error: "", remaining: null, stale: false, hasMore: false, cursor: null, retryText: "" });
export const chat = reactive(empty());
let seq = 0, ctrl = null, historyCtrl = null;
const key = id => id || null;
const cacheKey = owner => CHAT_CACHE_KEY + ":" + encodeURIComponent(owner);
function cacheRead(owner) { try { return readChatCache(localStorage.getItem(cacheKey(owner))); } catch { return {}; } }
function cacheWrite(owner, inspId, list) {
  try { localStorage.setItem(cacheKey(owner), JSON.stringify(putChatCache(cacheRead(owner), inspId || "none", list.filter(m => !m.failed && !m.pending)))); } catch { /* optional cache */ }
}
export function cancelAsk() {
  ctrl?.abort(); ctrl = null;
  seq++;
  chat.streaming = false;
  const reply = chat.messages[chat.messages.length - 1];
  if (reply?.pending) { reply.pending = false; reply.interrupted = true; }
}
watch(() => user.value?.id, () => {
  cancelAsk(); historyCtrl?.abort(); historyCtrl = null;
  Object.assign(chat, empty());
}, { flush: "sync" });
function baseQuery(inspId, owner) {
  let q = supabase.from("assistant_messages").select("id,role,content,created_at").eq("user_id", owner);
  return inspId ? q.eq("inspection_id", inspId) : q.is("inspection_id", null);
}
export async function loadHistory(inspId, older = false) {
  const owner = user.value?.id;
  if (!CLOUD || !owner || (older && (chat.loading || chat.streaming || !chat.hasMore))) return;
  if (!older) cancelAsk();
  historyCtrl?.abort();
  const controller = new AbortController(); historyCtrl = controller;
  const run = ++seq, timer = setTimeout(() => controller.abort(), 10000);
  const valid = () => seq === run && owner === user.value?.id;
  const cached = cacheRead(owner)[inspId || "none"] || [];
  chat.error = "";
  if (!older) {
    chat.loadedFor = key(inspId); chat.stale = false; chat.retryText = "";
    chat.messages = cached; chat.hasMore = false; chat.cursor = null;
    chat.loading = !cached.length; chat.refreshing = !!cached.length;
  } else chat.loading = true;
  try {
    let q = baseQuery(inspId, owner).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(60);
    if (older && chat.cursor) {
      const c = chat.cursor;
      if (!/^[0-9a-f-]{36}$/i.test(c.id) || !/^[0-9T:.+Z-]+$/.test(c.created_at)) throw new Error("Некоректний курсор історії");
      q = q.or("created_at.lt." + c.created_at + ",and(created_at.eq." + c.created_at + ",id.lt." + c.id + ")");
    }
    const { data, error } = await q.abortSignal(controller.signal);
    if (!valid()) return;
    if (error) throw error;
    const rows = data || [];
    const list = rows.slice().reverse().map(messageFromRow).filter(Boolean);
    chat.messages = older ? list.concat(chat.messages.filter(m => !list.some(n => n.id === m.id))) : list;
    chat.hasMore = rows.length === 60;
    chat.cursor = rows[rows.length - 1] || chat.cursor;
    cacheWrite(owner, inspId, chat.messages);
  } catch (e) {
    if (!valid()) return;
    chat.stale = chat.messages.length > 0;
    chat.error = controller.signal.aborted ? "Хмара не відповіла вчасно. Спробуй ще раз." : errText(e);
  } finally {
    clearTimeout(timer);
    if (valid()) { chat.loading = false; chat.refreshing = false; historyCtrl = null; }
  }
}
export const loadOlder = () => loadHistory(chat.loadedFor, true);
export async function ask(text, { inspId, context, lang } = {}) {
  text = String(text || "").trim();
  const owner = user.value?.id;
  if (!CLOUD || !owner || !text || chat.streaming || chat.loading || chat.refreshing) return false;
  const run = ++seq, controller = new AbortController(); ctrl = controller;
  const valid = () => run === seq && owner === user.value?.id && key(inspId) === chat.loadedFor;
  chat.streaming = true; chat.error = ""; chat.retryText = "";
  let timer, mine, reply;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), 60000); };
  arm();
  try {
    const { data: s, error } = await supabase.auth.getSession();
    if (!valid()) return false;
    if (error || !s?.session?.access_token) throw new Error("Потрібен вхід через Telegram");
    const id = crypto.randomUUID();
    mine = reactive({ id: "u" + id, role: "user", content: text, at: Date.now() });
    reply = reactive({ id: "a" + id, role: "assistant", content: "", at: Date.now(), pending: true });
    chat.messages.push(mine, reply);
    const res = await fetch(CLOUD_URL + "/functions/v1/assistant", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: CLOUD_KEY, Authorization: "Bearer " + s.session.access_token },
      body: JSON.stringify({ message: text, context: context || "", inspection_id: key(inspId), lang: lang || "uk" })
    });
    if (!valid()) return false;
    const rem = res.headers.get("x-remaining");
    if (rem !== null) chat.remaining = Number(rem);
    if (!res.ok) {
      let body = {}; try { body = await res.json(); } catch { /* non-json error */ }
      if (typeof body.remaining === "number") chat.remaining = body.remaining;
      throw new Error(body.error || "Помічник недоступний (" + res.status + ")");
    }
    if (!res.body) throw new Error("Порожня відповідь");
    const reader = res.body.getReader(), decoder = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (!valid()) { await reader.cancel(); return false; }
        if (done) break;
        arm(); reply.content += decoder.decode(value, { stream: true });
      }
      reply.content = (reply.content + decoder.decode()).trim();
    } finally { reader.releaseLock(); }
    if (!reply.content) throw new Error("Порожня відповідь, спробуй ще раз");
    reply.pending = false;
    cacheWrite(owner, inspId, chat.messages);
    return true;
  } catch (e) {
    if (valid()) {
      chat.error = controller.signal.aborted ? "Відповідь не надійшла вчасно. Можна повторити запитання." : errText(e);
      chat.retryText = text;
      if (mine) mine.failed = true;
      if (reply && !reply.content) chat.messages = chat.messages.filter(m => m.id !== reply.id);
      else if (reply) reply.interrupted = true;
    }
    return false;
  } finally {
    clearTimeout(timer);
    if (reply) reply.pending = false;
    if (valid()) { chat.streaming = false; ctrl = null; }
  }
}
export async function clearHistory(inspId) {
  const owner = user.value?.id;
  if (!CLOUD || !owner || chat.streaming || chat.loading || chat.refreshing) return;
  historyCtrl?.abort(); const run = ++seq;
  chat.loading = true;
  try {
    let q = supabase.from("assistant_messages").delete().eq("user_id", owner);
    q = inspId ? q.eq("inspection_id", inspId) : q.is("inspection_id", null);
    const { error } = await q;
    if (run !== seq || owner !== user.value?.id) return;
    if (error) throw error;
    Object.assign(chat, { messages: [], error: "", retryText: "", hasMore: false, cursor: null });
    cacheWrite(owner, inspId, []);
  } catch (e) { if (run === seq) chat.error = errText(e); }
  finally { if (run === seq) chat.loading = false; }
}
