/* Чиста логіка сховища: перевірка записів, розбір збереженого стану, резервна копія, злиття.
   Без Vue, DOM і localStorage — покрито тестами у tests/storage.test.js. */
import { modelApi, modelDef, registerModel, DEFAULT_MODEL } from "../data/index.js";
import { normalizeGenerated } from "./generated";

export const KEY = "golfcheck.v1";
export const MODELS_KEY = "golfcheck.models.v1";
export const BACKUP_APP = "golf-check";
export const BACKUP_VERSION = 4;

const STATUSES = new Set(["ok", "bad", "skip", ""]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (typeof v === "string" ? v : "").slice(0, max);
const posInt = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/* Модель запису: невідома або відсутня (старі записи) — Golf V. */
export const modelOf = raw => (raw && typeof raw.model === "string" && raw.model) ? raw.model : DEFAULT_MODEL;

/* Чи існує така конфігурація у довіднику моделі: мотор, кузов для нього, рік для пари, коробка для року. */
export function validConfig(cfg, modelId = DEFAULT_MODEL) {
  if (!isObj(cfg) || !modelDef(modelId)) return false;
  const G = modelApi(modelId);
  const e = G.engine(cfg.engine);
  if (!e || !e.bodies.includes(cfg.body)) return false;
  if (!Number.isInteger(cfg.year) || !G.yearsFor(cfg.engine, cfg.body).includes(cfg.year)) return false;
  return G.gearsFor(cfg.engine, cfg.year).some(g => g.id === cfg.gear);
}

function normalizeAnswers(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  Object.keys(raw).forEach(id => {
    if (UNSAFE_KEYS.has(id) || id.length > 60) return;
    const a = raw[id];
    if (!isObj(a)) return;
    const n = { s: STATUSES.has(a.s) ? a.s : "" };
    if (Array.isArray(a.tags)) {
      const tags = a.tags.filter(t => typeof t === "string" && t).map(t => t.slice(0, 60)).slice(0, 20);
      if (tags.length) n.tags = tags;
    }
    const c = str(a.c, 500);
    if (c) n.c = c;
    if (n.s || n.tags || n.c) out[id] = n;
  });
  return out;
}

export function normalizeSnapshot(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) return null;
  const ids = new Set(), stages = [];
  for (const s of raw) {
    if (!isObj(s) || !Array.isArray(s.items) || s.items.length > 300 || !str(s.id, 60)) return null;
    const items = [];
    for (const it of s.items) {
      if (!isObj(it) || !str(it.id, 60) || ids.has(it.id) || UNSAFE_KEYS.has(it.id) || !["crit", "major", "minor"].includes(it.sev) || !str(it.t, 200)) return null;
      ids.add(it.id);
      const item = { id: str(it.id, 60), t: str(it.t, 200), how: str(it.how, 2000), why: str(it.why, 2000), sev: it.sev };
      if (Array.isArray(it.cost) && it.cost.length === 2 && it.cost.every(n => Number.isFinite(n) && n >= 0)) item.cost = [Math.min(...it.cost), Math.max(...it.cost)];
      if (Array.isArray(it.tags)) item.tags = it.tags.filter(t => typeof t === "string").slice(0, 20).map(t => t.slice(0, 60));
      if (isObj(it.notes)) item.notes = Object.fromEntries(Object.entries(it.notes).filter(([k, v]) => !UNSAFE_KEYS.has(k) && typeof v === "string").map(([k, v]) => [k.slice(0, 60), v.slice(0, 2000)]));
      items.push(item);
    }
    stages.push({ id: str(s.id, 60), name: str(s.name, 200), short: str(s.short, 60), intro: str(s.intro, 2000), items });
  }
  return stages;
}

/* Повертає чистий запис огляду або null, якщо запис непридатний (немає id, невідома конфігурація). */
export function normalizeInspection(raw, now = Date.now()) {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 40);
  const model = modelOf(raw);
  if (!id || UNSAFE_KEYS.has(id) || !validConfig(raw.cfg, model)) return null;
  const createdAt = posInt(raw.createdAt) || now;
  const snapshot = normalizeSnapshot(raw.checklistSnapshot);
  if (raw.checklistSnapshot && !snapshot) return null;
  const price = raw.priceSnapshot;
  return {
    id,
    model,
    createdAt,
    updatedAt: posInt(raw.updatedAt) || createdAt,
    ...(posInt(raw._persist) ? { _persist: posInt(raw._persist) } : {}),
    name: str(raw.name, 60).trim(),
    price: posInt(raw.price),
    cfg: { engine: raw.cfg.engine, body: raw.cfg.body, year: raw.cfg.year, gear: raw.cfg.gear },
    answers: normalizeAnswers(raw.answers),
    stage: posInt(raw.stage),
    done: raw.done === true,
    ...(snapshot ? { checklistSnapshot: snapshot, reportVersion: 1 } : {}),
    ...(isObj(price) && Number.isFinite(price.lo) && Number.isFinite(price.hi) && price.lo >= 0 && price.hi >= price.lo ? { priceSnapshot: { lo: price.lo, hi: price.hi } } : {})
  };
}

/* Нормалізує список: відкидає непридатні записи, при однаковому id лишає новіший. */
export function normalizeList(list, now = Date.now()) {
  const byId = new Map();
  let rejected = 0;
  (Array.isArray(list) ? list : []).forEach(raw => {
    const n = normalizeInspection(raw, now);
    if (!n) { rejected++; return; }
    const prev = byId.get(n.id);
    if (!prev || n.updatedAt > prev.updatedAt) byId.set(n.id, n);
  });
  return { inspections: Array.from(byId.values()), rejected };
}

/* Розбір того, що лежить у localStorage. error: null | "parse" | "shape". */
export function parseState(text, now = Date.now()) {
  const empty = { inspections: [], hideInstall: false };
  if (text == null || text === "") return { state: empty, rejected: 0, error: null };
  let d;
  try { d = JSON.parse(text); } catch (e) { return { state: empty, rejected: 0, error: "parse" }; }
  if (!isObj(d) || !Array.isArray(d.inspections)) return { state: empty, rejected: 0, error: "shape" };
  const all = d.inspections.concat(Array.isArray(d.pendingInspections) ? d.pendingInspections : []);
  const pending = all.filter(r => isObj(r) && typeof r.id === "string" && !UNSAFE_KEYS.has(r.id) && typeof r.model === "string" && r.model && !modelDef(r.model) && isObj(r.cfg));
  const { inspections, rejected } = normalizeList(all.filter(r => !pending.includes(r)), now);
  return { state: { inspections, hideInstall: d.hideInstall === true, ...(pending.length ? { pendingInspections: pending } : {}) }, rejected, error: null };
}

/* Модель, яку склав ШІ: перевіряємо через ту саму нормалізацію, що й відповідь сервера, і реєструємо. */
export function normalizeModel(raw) {
  if (!isObj(raw) || !raw.ai) return null;
  /* Уже нормалізована модель тримає двигун і коробку у власних бібліотеках: збираємо з них «сиру» форму. */
  const e = isObj(raw.engineLib) ? raw.engineLib.e1 : null;
  const shaped = e ? Object.assign({}, raw, {
    engine: e,
    gearbox: Array.isArray(raw.gearboxLib) ? raw.gearboxLib[0] : null,
    body: Array.isArray(raw.bodies) ? raw.bodies[0] : null,
    price: Array.isArray(raw.engines) && raw.engines[0] ? raw.engines[0].price : null
  }) : raw;
  return normalizeGenerated(shaped, { id: raw.id, createdAt: raw.createdAt, source: raw.source });
}
/* Список моделей ШІ зі сховища або копії: придатні реєструються, сміття рахується. */
export function parseModels(text) {
  let list;
  try { list = typeof text === "string" ? JSON.parse(text) : text; } catch (e) { return { models: [], rejected: 0 }; }
  const models = []; let rejected = 0;
  (Array.isArray(list) ? list : []).forEach(raw => {
    const m = normalizeModel(raw);
    if (!m) { rejected++; return; }
    registerModel(m); models.push(m);
  });
  return { models, rejected };
}

/* Резервна копія: самодостатній JSON з позначкою застосунку і версією формату. Моделі ШІ їдуть разом. */
export function makeBackup(inspections, now = Date.now(), models = [], pending = []) {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), models: (models || []).filter(m => m && m.ai), inspections: normalizeList(inspections, now).inspections, ...(pending.length ? { pendingInspections: pending } : {}) };
}

/* Розбір копії. Кидає Error з текстом для користувача, якщо це не копія Golf Check. */
export function parseBackup(text, now = Date.now()) {
  let d;
  try { d = JSON.parse(String(text || "").trim()); } catch (e) { throw new Error("Це не файл копії: не вдалося прочитати JSON."); }
  if (!isObj(d) || !Array.isArray(d.inspections)) throw new Error("Це не копія Golf Check: немає списку оглядів.");
  if (d.app !== undefined && d.app !== BACKUP_APP) throw new Error("Це копія іншого застосунку.");
  if (Number.isFinite(d.version) && d.version > BACKUP_VERSION) throw new Error("Копію створено новішою версією Golf Check. Онови застосунок.");
  /* Спершу моделі ШІ, інакше огляди на них не пройдуть перевірку конфігурації. */
  const models = parseModels(d.models).models;
  const parsed = parseState(JSON.stringify(d), now);
  return { inspections: parsed.state.inspections, rejected: parsed.rejected, models, pendingInspections: parsed.state.pendingInspections || [] };
}

/* Злиття без втрат: нові додаються, з однаковим id перемагає новіший updatedAt, наявні не видаляються. */
export function mergeInspections(current, incoming) {
  const byId = new Map(current.map(i => [i.id, i]));
  let added = 0, updated = 0, skipped = 0;
  incoming.forEach(n => {
    const prev = byId.get(n.id);
    if (!prev) { byId.set(n.id, n); added++; }
    else if (n.updatedAt > prev.updatedAt) { byId.set(n.id, n); updated++; }
    else skipped++;
  });
  return { list: Array.from(byId.values()), added, updated, skipped };
}
