/* Чиста логіка контенту з адмінки: перетворення рядків бази у пункти чек-листа й фото, і назад.
   Без Vue і мережі — покрито тестами у tests/content.test.js. */
import CL from "../data/checklist.js";

export const SEVS = ["crit", "major", "minor"];
export const STAGE_IDS = CL.map(s => s.id);
const str = (v, max) => (typeof v === "string" ? v : "").trim().slice(0, max);
const strList = (v, max) => (Array.isArray(v) ? v : String(v || "").split(",")).map(t => String(t).trim()).filter(Boolean).slice(0, max);
const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : null; };

/* Рядок таблиці checklist_items → пункт чек-листа у форматі src/data/checklist.js. */
export function itemFromRow(r) {
  if (!r || !r.id || !STAGE_IDS.includes(r.stage) || !str(r.title, 200)) return null;
  const lo = int(r.cost_lo), hi = int(r.cost_hi);
  const it = {
    id: "c_" + r.id, dbId: r.id, custom: true,
    model: r.model || null, stage: r.stage,
    t: str(r.title, 200), how: str(r.how, 1000), why: str(r.why, 1000),
    sev: SEVS.includes(r.sev) ? r.sev : "major",
    sort: int(r.sort) ?? 100, enabled: r.enabled !== false
  };
  if (lo !== null && hi !== null && hi > 0) it.cost = [Math.min(lo, hi), Math.max(lo, hi)];
  const tags = strList(r.tags, 12); if (tags.length) it.tags = tags;
  const only = strList(r.only_tags, 8); if (only.length) it.only = only;
  return it;
}

/* Форма адмінки → рядок для таблиці. Повертає { row } або { error }. */
export function rowFromForm(f) {
  const title = str(f.title, 200), how = str(f.how, 1000);
  if (!title) return { error: "Вкажи назву пункту." };
  if (!how) return { error: "Опиши, як перевірити." };
  if (!STAGE_IDS.includes(f.stage)) return { error: "Обери етап." };
  const lo = int(f.cost_lo), hi = int(f.cost_hi);
  if ((lo === null) !== (hi === null)) return { error: "Вартість: заповни обидві межі або жодної." };
  return { row: {
    model: f.model || null, stage: f.stage, title, how, why: str(f.why, 1000),
    sev: SEVS.includes(f.sev) ? f.sev : "major",
    cost_lo: lo, cost_hi: hi === null ? null : Math.max(lo, hi),
    tags: strList(f.tags, 12), only_tags: strList(f.only_tags, 8),
    sort: int(f.sort) ?? 100, enabled: f.enabled !== false
  } };
}

/* Ключ фото: до чого воно прив'язане. kind: engine | gearbox | common | item. */
export const photoKey = (kind, target, idx) => kind + ":" + target + ":" + (idx || 0);
export function photoFromRow(r) {
  if (!r || !r.id || !r.path || !["engine", "gearbox", "common", "item"].includes(r.kind)) return null;
  return { id: r.id, model: r.model || null, kind: r.kind, target: String(r.target), idx: int(r.idx) ?? 0, path: r.path, caption: str(r.caption, 200), key: photoKey(r.kind, r.target, int(r.idx) ?? 0) };
}
export function photosFor(list, kind, target, idx, model) {
  const key = photoKey(kind, target, idx);
  return (list || []).filter(p => p.key === key && (!p.model || !model || p.model === model));
}
