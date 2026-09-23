import { describe, it, expect } from "vitest";
import CL from "../src/data/checklist.js";
import { visibleStages, computeReport } from "../src/logic/report";
import { normalizeSnapshot, normalizeInspection } from "../src/logic/storage";
import { hydrateSnapshot } from "../src/logic/snapshot";
import { CFG, mkInsp, answersBy } from "./helpers";

const ITEM = new Map(CL.flatMap(s => s.items.map(it => [it.id, it])));
const answers = () => answersBy(CFG, (it, k) => (k % 9 === 0 ? "bad" : k % 5 === 0 ? "skip" : "ok"));
const fullSnapshot = () => JSON.parse(JSON.stringify(visibleStages(mkInsp(CFG))));
const summary = r => ({ verdict: r.verdict, score: r.score, pct: r.pct, total: r.total, cost: r.cost, fails: Object.values(r.fails).flat().map(f => f.it.id) });

describe("компактний знімок чек-листа", () => {
  it("важить у рази менше за повну копію", () => {
    const full = JSON.stringify(fullSnapshot()).length, compact = JSON.stringify(normalizeSnapshot(fullSnapshot())).length;
    expect(compact).toBeLessThan(full / 3);
  });
  it("після розгортання дає ті самі етапи, пункти і тексти, що й довідник", () => {
    const live = visibleStages(mkInsp(CFG));
    const back = hydrateSnapshot(normalizeSnapshot(fullSnapshot()));
    expect(back.map(s => s.id)).toEqual(live.map(s => s.id));
    back.forEach((s, k) => {
      expect(s.intro).toBe(live[k].intro);
      expect(s.items.map(it => [it.id, it.t, it.sev, it.cost, it.how, it.why, it.tags, it.notes]))
        .toEqual(live[k].items.map(it => [it.id, it.t, it.sev, it.cost, it.how, it.why, it.tags, it.notes]));
    });
  });
  it("звіт за знімком збігається зі звітом за живим довідником", () => {
    const a = answers();
    const withSnap = { ...mkInsp(CFG, a), checklistSnapshot: normalizeSnapshot(fullSnapshot()) };
    expect(summary(computeReport(withSnap))).toEqual(summary(computeReport(mkInsp(CFG, a))));
  });
  it("вага і вартість — лише зі знімка, навіть якщо довідник змінився", () => {
    const withCost = [...ITEM.values()].find(it => it.cost), noCost = [...ITEM.values()].find(it => !it.cost);
    const snap = normalizeSnapshot([{ id: "docs", name: "Документи", items: [
      { id: withCost.id, t: withCost.t, sev: "minor" },
      { id: noCost.id, t: noCost.t, sev: "crit", cost: [1, 2] }
    ] }]);
    const [a, b] = hydrateSnapshot(snap)[0].items;
    expect(a.sev).toBe("minor"); expect(a.cost).toBeUndefined(); expect(a.how).toBe(withCost.how);
    expect(b.sev).toBe("crit"); expect(b.cost).toEqual([1, 2]);
  });
  it("власні пункти (адмінка, ШІ) зберігаються повністю", () => {
    const snap = normalizeSnapshot([{ id: "body", name: "Кузов", items: [{ id: "c_42", t: "Власний", how: "Подивись під килимок", why: "Волога", sev: "major", tags: ["іржа"] }] }]);
    expect(snap[0].items[0]).toEqual({ id: "c_42", t: "Власний", sev: "major", how: "Подивись під килимок", why: "Волога", tags: ["іржа"] });
    expect(hydrateSnapshot(snap)[0].items[0].how).toBe("Подивись під килимок");
  });
  it("старий повний знімок стискається під час завантаження без зміни звіту", () => {
    const a = answers();
    const old = { ...mkInsp(CFG, a), checklistSnapshot: fullSnapshot(), reportVersion: 1 };
    const loaded = normalizeInspection(JSON.parse(JSON.stringify(old)));
    expect(JSON.stringify(loaded).length).toBeLessThan(JSON.stringify(old).length / 3);
    expect(summary(computeReport(loaded))).toEqual(summary(computeReport(old)));
  });
  it("лишається масивом етапів з назвою і sev у кожного пункту — його читають і старі версії", () => {
    const snap = normalizeSnapshot(fullSnapshot());
    expect(Array.isArray(snap)).toBe(true);
    snap.forEach(s => { expect(typeof s.name).toBe("string"); s.items.forEach(it => { expect(it.t).toBeTruthy(); expect(["crit", "major", "minor"]).toContain(it.sev); }); });
  });
  it("розгортання кешується: той самий знімок дає той самий результат", () => {
    const snap = normalizeSnapshot(fullSnapshot());
    expect(hydrateSnapshot(snap)).toBe(hydrateSnapshot(snap));
  });
});
