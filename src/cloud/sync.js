/* Serialized, account-scoped synchronization with optimistic server revisions. */
import { reactive, watch } from "vue";
import { CLOUD, supabase, errText } from "./client";
import { user } from "./auth";
import { account, db, replaceInspections, flush, toast, saveModels, restorePending, modelDef, onDataChange, uid } from "../store";
import { normalizeList, parseModels } from "../logic/storage";
import { normalizeGenerated } from "../logic/generated";

export const sync = reactive({ state: "idle", lastAt: 0, error: "", pending: 0 });
const fresh = () => ({ pushed: {}, revisions: {}, deleted: {} });
let meta = fresh(), scope = "guest", epoch = 0, task = null, requested = false, timer;
const key = () => "golfcheck.sync.v2:" + encodeURIComponent(scope);
const safeId = id => typeof id === "string" && !["__proto__", "constructor", "prototype"].includes(id);
function readMeta() {
  const out = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(key()) || "{}");
    for (const part of Object.keys(out)) for (const [id, value] of Object.entries(saved[part] || {})) {
      if (safeId(id) && Number.isFinite(value) && value >= 0) out[part][id] = value;
    }
  } catch { /* unavailable */ }
  return out;
}
function saveMeta() {
  localStorage.setItem(key(), JSON.stringify(meta));
}
const dirty = () => db.inspections.filter(i => i.updatedAt > (meta.pushed[i.id] || 0));
const count = () => { sync.pending = scope === "guest" ? 0 : dirty().length + Object.keys(meta.deleted).length; };
const current = run => run === epoch && user.value?.id === scope && account.scope === scope;
const fromRow = r => ({ id: r.id, model: r.model, name: r.name, price: r.price, cfg: r.cfg, answers: r.answers,
  stage: r.stage, done: r.done, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at),
  checklistSnapshot: r.checklist_snapshot, priceSnapshot: r.price_snapshot, reportVersion: r.report_version });
const toRow = i => ({ id: i.id, model: i.model, name: i.name, price: i.price, cfg: i.cfg, answers: i.answers,
  stage: i.stage, done: i.done, created_at: new Date(i.createdAt).toISOString(), updated_at: new Date(i.updatedAt).toISOString(),
  checklist_snapshot: i.checklistSnapshot || null, price_snapshot: i.priceSnapshot || null, report_version: i.reportVersion || 1,
  model_snapshot: modelDef(i.model)?.ai ? modelDef(i.model) : null });
function applyRemote(row, force = false) {
  if (!safeId(row.id)) return;
  const revision = Number(row.revision) || 0;
  if (!force && revision <= (meta.revisions[row.id] || 0)) return;
  const local = db.inspections.find(i => i.id === row.id);
  const list = db.inspections.slice();
  if (local && local.updatedAt > (meta.pushed[local.id] || 0)) {
    list.push({ ...JSON.parse(JSON.stringify(local)), id: uid(), name: (local.name || "Огляд").slice(0, 40) + " · локальна копія", updatedAt: Date.now() });
    toast("Є зміни з іншого пристрою. Твої відповіді збережено окремою локальною копією.", 5000);
  }
  const incoming = row.deleted_at ? null : normalizeList([fromRow(row)]).inspections[0];
  if (!row.deleted_at && !incoming) throw new Error("Не вдалося прочитати огляд з хмари. Локальні дані збережено.");
  const filtered = list.filter(i => i.id !== row.id);
  if (incoming) filtered.push(incoming);
  replaceInspections(filtered, true);
  meta.revisions[row.id] = revision;
  if (incoming) meta.pushed[row.id] = incoming.updatedAt;
  else delete meta.pushed[row.id];
}
async function allRows(table, columns, owner, run) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from(table).select(columns).eq("user_id", owner).order("id").range(start, start + 499);
    if (!current(run)) return null;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
async function cycle(run) {
  const owner = scope;
  const models = await allRows("custom_models", "id,input,def,created_at", owner, run);
  if (!current(run)) return;
  if (models.length) {
    const defs = models.map(r => normalizeGenerated(r.def, { id: r.id, createdAt: Date.parse(r.created_at), source: { ...r.input, year: Number(r.input?.year) } })).filter(Boolean);
    if (parseModels(defs).models.length) {
      restorePending();
      if (!saveModels()) throw new Error("Не вдалося зберегти моделі на пристрої");
    }
  }
  const rows = await allRows("inspections", "*", owner, run);
  if (!current(run)) return;
  if (parseModels(rows.filter(r => !r.deleted_at && r.model_snapshot).map(r => r.model_snapshot)).models.length) {
    restorePending();
    if (!saveModels()) throw new Error("Не вдалося зберегти моделі на пристрої");
  }
  for (const row of rows) if (!meta.deleted[row.id]) applyRemote(row);
  if (!flush()) throw new Error("Не вдалося зберегти огляди на пристрої");
  saveMeta();
  // Take immutable copies before the first await. A later edit stays dirty.
  const writes = dirty().map(i => ({ id: i.id, stamp: i.updatedAt, base: meta.revisions[i.id] || 0, record: JSON.parse(JSON.stringify(toRow(i))) }));
  const deletes = Object.entries(meta.deleted).map(([id, stamp]) => ({ id, stamp, base: meta.revisions[id] || 0, deleted: true }));
  for (const change of [...writes, ...deletes]) {
    if (!current(run)) return;
    const { data, error } = await supabase.rpc("sync_inspection", { p_id: change.id, p_base_revision: change.base, p_record: change.deleted ? null : change.record });
    if (!current(run)) return;
    if (error) throw error;
    if (!data?.row) throw new Error("Хмара не підтвердила збереження");
    if (data.conflict) {
      applyRemote(data.row, true);
      toast("Конфлікт синхронізації: перевір оновлений список оглядів.", 4000);
    } else {
      meta.revisions[change.id] = Number(data.row.revision);
      if (!change.deleted) meta.pushed[change.id] = change.stamp;
    }
    if (change.deleted && meta.deleted[change.id] === change.stamp) delete meta.deleted[change.id];
    if (!flush()) throw new Error("Не вдалося зберегти зміни на пристрої");
    saveMeta();
  }
}
export function fullSync() {
  if (!CLOUD || !user.value || !navigator.onLine || account.scope !== user.value.id) return Promise.resolve(false);
  requested = true;
  if (task) return task;
  task = (async () => {
    while (requested) {
      requested = false;
      const run = epoch;
      if (!current(run) || !navigator.onLine) break;
      sync.state = "syncing";
      try {
        await cycle(run);
        if (!current(run)) continue;
        sync.state = "idle"; sync.error = ""; sync.lastAt = Date.now();
        count();
        if (sync.pending) requested = true;
      } catch (e) {
        if (current(run)) { sync.state = "error"; sync.error = errText(e); count(); }
        requested = false;
      }
    }
    return !sync.error;
  })().finally(() => { task = null; });
  return task;
}
export const push = fullSync;
export const pull = fullSync;
function schedule() { clearTimeout(timer); timer = setTimeout(fullSync, 1500); count(); }
export function initSync() {
  if (!CLOUD) return;
  watch(() => user.value?.id, id => {
    clearTimeout(timer); epoch++; scope = id || "guest"; meta = readMeta(); requested = false;
    Object.assign(sync, { state: "idle", error: "", lastAt: 0, pending: 0 });
    count();
    if (id) fullSync();
  }, { immediate: true, flush: "sync" });
  onDataChange(event => {
    if (account.scope !== scope || scope === "guest" || ["account", "remote", "draft", "prefs"].includes(event.type)) return;
    if (event.type === "delete") {
      meta.deleted[event.id] = Date.now();
      delete meta.pushed[event.id];
      try { saveMeta(); } catch (e) { sync.state = "error"; sync.error = errText(e); }
    }
    schedule();
  });
  window.addEventListener("online", schedule);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(); });
}
