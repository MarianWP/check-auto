import { modelApi, MODELS, DEFAULT_MODEL } from "../src/data/index.js";
import { visibleStages } from "../src/logic/report";

export const CFG = { engine: "mpi14", body: "h3", year: 2003, gear: "m5" };
export const OCTAVIA_CFG = { engine: "tsi122", body: "combi", year: 2011, gear: "dsg7" };

/* Усі конфігурації, які дозволяє конфігуратор для моделі: мотор → кузов → рік → коробка. */
export function allConfigs(modelId = DEFAULT_MODEL) {
  const G = modelApi(modelId);
  const out = [];
  G.ENGINES.forEach(e => e.bodies.forEach(b => G.yearsFor(e.id, b).forEach(y => G.gearsFor(e.id, y).forEach(g => {
    out.push({ engine: e.id, body: b, year: y, gear: g.id });
  }))));
  return out;
}
export const allModelIds = () => MODELS.map(m => m.id);

export function mkInsp(cfg = CFG, answers = {}, model = DEFAULT_MODEL) {
  return { id: "t1", model, createdAt: 1000, updatedAt: 1000, name: "", price: 0, cfg, answers, stage: 0, done: false };
}

export const items = (cfg = CFG, model = DEFAULT_MODEL) => visibleStages(mkInsp(cfg, {}, model)).flatMap(s => s.items);

/* answers з функції (item, index) → "ok" | "bad" | "skip" | "" */
export function answersBy(cfg, fn) {
  const a = {};
  items(cfg).forEach((it, k) => { const s = fn(it, k); if (s) a[it.id] = { s }; });
  return a;
}
