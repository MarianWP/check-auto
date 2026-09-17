import G from "../src/data/golf";
import { visibleStages } from "../src/logic/report";

export const CFG = { engine: "mpi14", body: "h3", year: 2003, gear: "m5" };

/* Усі конфігурації, які дозволяє конфігуратор: мотор → кузов → рік → коробка. */
export function allConfigs() {
  const out = [];
  G.ENGINES.forEach(e => e.bodies.forEach(b => G.yearsFor(e.id, b).forEach(y => G.gearsFor(e.id, y).forEach(g => {
    out.push({ engine: e.id, body: b, year: y, gear: g.id });
  }))));
  return out;
}

export function mkInsp(cfg = CFG, answers = {}) {
  return { id: "t1", createdAt: 1000, updatedAt: 1000, name: "", price: 0, cfg, answers, stage: 0, done: false };
}

export const items = (cfg = CFG) => visibleStages(mkInsp(cfg)).flatMap(s => s.items);

/* answers з функції (item, index) → "ok" | "bad" | "skip" | "" */
export function answersBy(cfg, fn) {
  const a = {};
  items(cfg).forEach((it, k) => { const s = fn(it, k); if (s) a[it.id] = { s }; });
  return a;
}
