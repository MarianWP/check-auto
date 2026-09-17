/* Чиста логіка сховища: перевірка записів, розбір збереженого стану, резервна копія, злиття.
   Без Vue, DOM і localStorage — покрито тестами у tests/storage.test.js. */
import G from "../data/golf";

export const KEY = "golfcheck.v1";
export const BACKUP_APP = "golf-check";
export const BACKUP_VERSION = 1;

const STATUSES = new Set(["ok", "bad", "skip", ""]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (typeof v === "string" ? v : "").slice(0, max);
const posInt = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/* Чи існує така конфігурація у довіднику: мотор, кузов для нього, рік для пари, коробка для року. */
export function validConfig(cfg) {
  if (!isObj(cfg)) return false;
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

/* Повертає чистий запис перевірки або null, якщо запис непридатний (немає id, невідома конфігурація). */
export function normalizeInspection(raw, now = Date.now()) {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 40);
  if (!id || !validConfig(raw.cfg)) return null;
  const createdAt = posInt(raw.createdAt) || now;
  return {
    id,
    createdAt,
    updatedAt: posInt(raw.updatedAt) || createdAt,
    name: str(raw.name, 60).trim(),
    price: posInt(raw.price),
    cfg: { engine: raw.cfg.engine, body: raw.cfg.body, year: raw.cfg.year, gear: raw.cfg.gear },
    answers: normalizeAnswers(raw.answers),
    stage: posInt(raw.stage),
    done: raw.done === true
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
  const { inspections, rejected } = normalizeList(d.inspections, now);
  return { state: { inspections, hideInstall: d.hideInstall === true }, rejected, error: null };
}

/* Резервна копія: самодостатній JSON з позначкою застосунку і версією формату. */
export function makeBackup(inspections, now = Date.now()) {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), inspections: normalizeList(inspections, now).inspections };
}

/* Розбір копії. Кидає Error з текстом для користувача, якщо це не копія Golf Check. */
export function parseBackup(text, now = Date.now()) {
  let d;
  try { d = JSON.parse(String(text || "").trim()); } catch (e) { throw new Error("Це не файл копії: не вдалося прочитати JSON."); }
  if (!isObj(d) || !Array.isArray(d.inspections)) throw new Error("Це не копія Golf Check: немає списку перевірок.");
  if (d.app !== undefined && d.app !== BACKUP_APP) throw new Error("Це копія іншого застосунку.");
  if (Number.isFinite(d.version) && d.version > BACKUP_VERSION) throw new Error("Копію створено новішою версією Golf Check. Онови застосунок.");
  return normalizeList(d.inspections, now);
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
