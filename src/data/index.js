/* Реєстр моделей і API довідника для однієї моделі.
   modelApi(id) повертає той самий інтерфейс, що раніше давав golf.js: ENGINES, BODIES, GEARBOXES, engine(),
   yearsFor(), gearsFor(), priceFor(), tagsFor(), label(). Двигуни збираються з бібліотеки (engines.js)
   плюс поля моделі (роки, кузови, коробки, ціна). */
import ENGINE_LIB from "./engines.js";
import GEARBOXES from "./gearboxes.js";
import GOLF5 from "./models/golf5.js";
import OCTAVIA5 from "./models/octavia5.js";

export const DEFAULT_MODEL = "golf5";
export const MODELS = [GOLF5, OCTAVIA5];
const byId = Object.fromEntries(MODELS.map(m => [m.id, m]));
const cache = new Map();

export const modelDef = id => byId[id] || null;
export const modelIdOf = i => (i && i.model && byId[i.model]) ? i.model : DEFAULT_MODEL;

function build(m) {
  const engines = m.engines
    .filter(ref => ENGINE_LIB[ref.id])
    .map(ref => Object.assign({}, ENGINE_LIB[ref.id], { id: ref.id, years: ref.years, bodies: ref.bodies, gears: ref.gears, price: ref.price }));
  const engine = id => engines.find(e => e.id === id);
  const body = id => m.bodies.find(b => b.id === id);
  const gearbox = id => GEARBOXES.find(g => g.id === id);
  function yearsFor(engineId, bodyId) {
    const e = engine(engineId), b = body(bodyId);
    if (!e) return [];
    const lo = Math.max(e.years[0], b ? b.years[0] : m.years[0]);
    const hi = Math.min(e.years[1], b ? b.years[1] : m.years[1]);
    const out = [];
    for (let y = lo; y <= hi; y++) out.push(y);
    return out;
  }
  function gearsFor(engineId, year) {
    const e = engine(engineId);
    if (!e) return [];
    const min = m.gearMinYear || {};
    return e.gears.filter(g => !(year && min[g] && year < min[g])).map(gearbox).filter(Boolean);
  }
  function priceFor(cfg) {
    const e = engine(cfg.engine), b = body(cfg.body), g = gearbox(cfg.gear);
    if (!e) return null;
    const base = m.priceBaseYear || Math.round((m.years[0] + m.years[1]) / 2);
    const yf = 1 + ((cfg.year || base) - base) * 0.06;
    const f = yf * (b ? b.factor : 1) * (g ? g.factor : 1);
    const r = v => Math.round(v * f / 100) * 100;
    return { lo: r(e.price[0]), hi: r(e.price[1]) };
  }
  /* Набір тегів конфігурації — для фільтрів чек-листа (only / notes). */
  function tagsFor(cfg) {
    const e = engine(cfg.engine), g = gearbox(cfg.gear);
    const s = new Set();
    if (e) e.tags.forEach(t => s.add(t));
    if (g) g.tags.forEach(t => s.add(t));
    return s;
  }
  function label(cfg) {
    const e = engine(cfg.engine), b = body(cfg.body), g = gearbox(cfg.gear);
    return [e ? e.name : "", cfg.year || "", b ? b.short : "", g ? g.short : ""].filter(Boolean).join(" · ");
  }
  return {
    id: m.id, model: m, MARKET: m.market, BODIES: m.bodies, GEARBOXES, ENGINES: engines,
    COMMON: m.common, VIN: m.vin, PLANTS: m.plants, TRIMS: m.trims, KIT: m.kit,
    engine, body, gearbox, yearsFor, gearsFor, priceFor, tagsFor, label
  };
}

export function modelApi(id) {
  const m = byId[id] || byId[DEFAULT_MODEL];
  if (!cache.has(m.id)) cache.set(m.id, build(m));
  return cache.get(m.id);
}
/* API для запису огляду (поле model; старі записи без нього — Golf V). */
export const apiOf = i => modelApi(modelIdOf(i));
export { ENGINE_LIB, GEARBOXES };
