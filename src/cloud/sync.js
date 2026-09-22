/* Синхронізація оглядів із Supabase (таблиця inspections, лише власні рядки через RLS).
   Локальне сховище лишається головним і працює офлайн; хмара — копія для інших пристроїв.
   Правило злиття: з однаковим id перемагає новіший updatedAt; видалене локально видаляється і в хмарі. */
import { reactive, watch } from "vue";
import { CLOUD, supabase, errText } from "./client";
import { auth, user } from "./auth";
import { db, replaceInspections, flush, toast } from "../store";
import { normalizeList, mergeInspections } from "../logic/storage";

export const sync = reactive({ state: "idle", lastAt: 0, error: "", pending: 0 });
const SKEY = "golfcheck.sync.v1";
let meta = { pushed: {}, deleted: [] };
try { meta = Object.assign(meta, JSON.parse(localStorage.getItem(SKEY) || "{}")); } catch (e) { /* немає доступу */ }
const saveMeta = () => { try { localStorage.setItem(SKEY, JSON.stringify(meta)); } catch (e) { /* немає місця */ } };
let known = new Set(db.inspections.map(i => i.id));

const toRow = (i, uid) => ({
  id: i.id, user_id: uid, model: i.model, name: i.name, price: i.price, cfg: i.cfg, answers: i.answers,
  stage: i.stage, done: i.done, created_at: new Date(i.createdAt).toISOString(), updated_at: new Date(i.updatedAt).toISOString()
});
const fromRow = r => ({
  id: r.id, model: r.model, name: r.name || "", price: r.price || 0, cfg: r.cfg, answers: r.answers || {},
  stage: r.stage || 0, done: !!r.done, createdAt: Date.parse(r.created_at) || Date.now(), updatedAt: Date.parse(r.updated_at) || Date.now()
});
const dirty = () => db.inspections.filter(i => (meta.pushed[i.id] || 0) < i.updatedAt);
const countPending = () => { sync.pending = dirty().length + meta.deleted.length; };

export async function push() {
  if (!CLOUD || !user.value || !navigator.onLine) return;
  const uid = user.value.id;
  const list = dirty();
  if (!list.length && !meta.deleted.length) return;
  sync.state = "syncing";
  try {
    if (list.length) {
      const { error } = await supabase.from("inspections").upsert(list.map(i => toRow(i, uid)), { onConflict: "id" });
      if (error) throw error;
      list.forEach(i => { meta.pushed[i.id] = i.updatedAt; });
    }
    if (meta.deleted.length) {
      const { error } = await supabase.from("inspections").delete().in("id", meta.deleted);
      if (error) throw error;
      meta.deleted = [];
    }
    saveMeta(); sync.error = ""; sync.lastAt = Date.now(); sync.state = "idle";
  } catch (e) { sync.error = errText(e); sync.state = "error"; }
  countPending();
}

export async function pull() {
  if (!CLOUD || !user.value || !navigator.onLine) return;
  sync.state = "syncing";
  try {
    const { data, error } = await supabase.from("inspections").select("*").eq("user_id", user.value.id);
    if (error) throw error;
    const incoming = normalizeList((data || []).map(fromRow)).inspections;
    /* Видалене локально, але ще не в хмарі, не повертаємо назад. */
    const del = new Set(meta.deleted);
    const res = mergeInspections(db.inspections, incoming.filter(i => !del.has(i.id)));
    if (res.added || res.updated) { replaceInspections(res.list); flush(); }
    incoming.forEach(i => { const local = res.list.find(x => x.id === i.id); if (local && local.updatedAt <= i.updatedAt) meta.pushed[i.id] = local.updatedAt; });
    known = new Set(res.list.map(i => i.id));
    saveMeta(); sync.error = ""; sync.lastAt = Date.now(); sync.state = "idle";
    if (res.added || res.updated) toast("Огляди з хмари підтягнуто: " + (res.added + res.updated));
  } catch (e) { sync.error = errText(e); sync.state = "error"; }
  countPending();
}

export async function fullSync() { await pull(); await push(); }

let pushT = null;
const schedulePush = () => { clearTimeout(pushT); pushT = setTimeout(push, 1500); countPending(); };

export function initSync() {
  if (!CLOUD) return;
  countPending();
  watch(db, () => {
    const now = new Set(db.inspections.map(i => i.id));
    known.forEach(id => { if (!now.has(id)) { meta.deleted.push(id); delete meta.pushed[id]; } });
    known = now; saveMeta();
    schedulePush();
  }, { deep: true });
  watch(() => user.value && user.value.id, uid => { if (uid) fullSync(); else { sync.state = "idle"; sync.pending = 0; } }, { immediate: true });
  window.addEventListener("online", schedulePush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && auth.session) push(); });
}
