import { describe, it, expect } from "vitest";
import { normalizeGenerated, aiItemsOf, inputError, GEN_STEPS } from "../src/logic/generated";
import { registerModel, unregisterModel, modelApi, modelDef, MODELS } from "../src/data/index.js";
import { validConfig, normalizeInspection, makeBackup, parseBackup, parseModels } from "../src/logic/storage";
import { checklistFor, visibleStages, computeReport } from "../src/logic/report";
import CL from "../src/data/checklist";

export const RAW = {
  brand: "Toyota", name: "Corolla E150", full: "Toyota Corolla E150 (2007–2013)", years: [2007, 2013],
  body: { name: "Седан", short: "Седан" }, market: { avg: 7800, search: "https://auto.ria.com/uk/car/toyota/corolla/" }, price: [6500, 9000],
  engine: { name: "1.6 Dual VVT-i", codes: "1ZR-FE", hp: "124 к.с.", fuel: "petrol", tags: ["petrol", "chain", "weird"], reliability: 5, lpg: "ok", timing: { type: "chain", text: "Ланцюг, без регламенту." }, summary: "Надійний атмосферний мотор.", verdict: "Брати сміливо.", issues: [{ t: "Підвищена витрата масла", d: "Після 150 тис. км.", sev: "major", cost: [300, 100] }, { t: "", d: "без назви" }] },
  gearbox: { name: "МКПП, 5 ступенів", short: "МКПП-5", tags: ["manual"], reliability: 5, summary: "Проста коробка.", issues: [{ t: "Зчеплення", d: "Ресурс 150 тис.", cost: [200, 350] }] },
  common: [{ t: "Іржа арок", d: "Дивись задні арки.", cost: [200, 500] }],
  vin: { rows: [["1–3", "JTN — Toyota, Японія"], ["x"]], places: ["Під лобовим склом"] },
  plants: [{ code: "J", name: "Японія", note: "" }], trims: [{ name: "Comfort", note: "База." }], kit: ["Ліхтарик", "OBD-сканер"],
  items: [{ stage: "engine", t: "Ланцюг ГРМ не гримить при пуску", how: "Слухай перші секунди.", why: "Розтяг ланцюга.", sev: "major", cost: [250, 400] }, { stage: "nope", t: "x", how: "y" }, { stage: "body", t: "Арки без іржі", how: "Магніт і ліхтарик." }]
};
const META = { id: "ai_test1", createdAt: 1000, source: { brand: "Toyota", model: "Corolla", year: 2010, fuel: "petrol", engine: "1.6 бензин", gear: "manual", body: "Седан" } };

describe("картка від ШІ → модель реєстру", () => {
  it("будує модель із власними бібліотеками, чистить сміття", () => {
    const d = normalizeGenerated(RAW, META);
    expect(d.id).toBe("ai_test1");
    expect(d.ai).toBe(true);
    expect(d.full).toBe("Toyota Corolla E150 (2007–2013)");
    expect(d.years).toEqual([2007, 2013]);
    expect(d.engineLib.e1.tags).toEqual(["petrol", "chain"]);
    expect(d.engineLib.e1.issues).toHaveLength(1);
    expect(d.engineLib.e1.issues[0].cost).toEqual([100, 300]);
    expect(d.gearboxLib[0].tags).toEqual(["manual"]);
    expect(d.vin.rows).toEqual([["1–3", "JTN — Toyota, Японія"]]);
    expect(d.items).toHaveLength(2);
    expect(d.items[0].id).toBe("ai_test1_0");
    expect(d.items[1].cost).toBeUndefined();
    expect(d.source.year).toBe(2010);
  });
  it("рік користувача завжди в межах років моделі", () => {
    const d = normalizeGenerated(Object.assign({}, RAW, { years: [2012, 2013] }), META);
    expect(d.years[0]).toBeLessThanOrEqual(2010);
  });
  it("без двигуна або марки → null; мінімальна відповідь → модель з типовими значеннями", () => {
    expect(normalizeGenerated({}, META)).toBeNull();
    expect(normalizeGenerated(RAW, null)).toBeNull();
    expect(normalizeGenerated({ engine: { name: "2.0" } }, { id: "ai_x", source: {} })).toBeNull();
    const d = normalizeGenerated({ engine: { name: "2.0 дизель" } }, { id: "ai_min", source: { brand: "Ford", model: "Focus", year: 2015 } });
    expect(d.brand).toBe("Ford");
    expect(d.engineLib.e1.fuel).toBe("petrol");
    expect(d.engines[0].price[0]).toBeLessThan(d.engines[0].price[1]);
    expect(d.gearboxLib[0].name).toBe("Не знаю");
    expect(d.market.search).toContain("auto.ria.com");
  });
  it("форма: помилки введення", () => {
    expect(inputError({ brand: "", model: "x", year: 2010 })).toMatch(/марку/);
    expect(inputError({ brand: "Ford", model: " ", year: 2010 })).toMatch(/модель/);
    expect(inputError({ brand: "Ford", model: "Focus", year: 1980 })).toMatch(/рік/);
    expect(inputError({ brand: "Ford", model: "Focus", year: "2015" })).toBe("");
    expect(GEN_STEPS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("згенерована модель у реєстрі, сховищі й чек-листі", () => {
  const def = normalizeGenerated(RAW, META);
  it("registerModel робить модель видимою для modelApi, validConfig і normalizeInspection", () => {
    registerModel(def);
    expect(modelDef("ai_test1").brand).toBe("Toyota");
    expect(MODELS.some(m => m.id === "ai_test1")).toBe(true);
    const G = modelApi("ai_test1");
    expect(G.engine("e1").name).toBe("1.6 Dual VVT-i");
    expect(G.gearsFor("e1", 2010).map(g => g.id)).toEqual(["g1"]);
    expect(G.yearsFor("e1", "b1")).toContain(2010);
    expect(G.priceFor({ engine: "e1", body: "b1", year: 2010, gear: "g1" }).lo).toBeGreaterThan(0);
    expect(G.label({ engine: "e1", body: "b1", year: 2010, gear: "g1" })).toContain("2010");
    expect(G.tagsFor({ engine: "e1", gear: "g1" })).toEqual(new Set(["petrol", "chain", "manual"]));
    const cfg = { engine: "e1", body: "b1", year: 2010, gear: "g1" };
    expect(validConfig(cfg, "ai_test1")).toBe(true);
    expect(validConfig(cfg, "golf5")).toBe(false);
    expect(normalizeInspection({ id: "i1", model: "ai_test1", cfg }, 5).model).toBe("ai_test1");
  });
  it("пункти від ШІ додаються до чек-листа лише цієї моделі і рахуються у звіті", () => {
    const extra = aiItemsOf(def);
    expect(extra).toHaveLength(2);
    const i = { id: "i1", model: "ai_test1", cfg: { engine: "e1", body: "b1", year: 2010, gear: "g1" }, answers: { ai_test1_0: { s: "bad" } } };
    const eng = checklistFor(i, CL, extra).find(s => s.id === "engine");
    expect(eng.items[eng.items.length - 1].id).toBe("ai_test1_0");
    const golf = { id: "i2", model: "golf5", cfg: { engine: "mpi16", body: "h5", year: 2006, gear: "m5" }, answers: {} };
    expect(checklistFor(golf, CL, extra).flatMap(s => s.items).some(x => x.ai)).toBe(false);
    const rep = computeReport(i, CL, extra);
    expect(rep.fails.major.some(f => f.it.ai)).toBe(true);
    expect(visibleStages(i, CL, extra).flatMap(s => s.items).length).toBe(rep.total);
  });
  it("резервна копія несе моделі ШІ: після відновлення огляд на такій моделі приймається", () => {
    const insp = normalizeInspection({ id: "i1", model: "ai_test1", cfg: { engine: "e1", body: "b1", year: 2010, gear: "g1" } }, 5);
    const b = makeBackup([insp], 5, [def]);
    expect(b.version).toBe(3);
    expect(b.models).toHaveLength(1);
    unregisterModel("ai_test1");
    expect(modelDef("ai_test1")).toBeNull();
    const res = parseBackup(JSON.stringify(b), 5);
    expect(res.models).toHaveLength(1);
    expect(res.inspections).toHaveLength(1);
    expect(modelDef("ai_test1")).not.toBeNull();
  });
  it("parseModels зі сховища: сміття відкидається, придатні реєструються", () => {
    unregisterModel("ai_test1");
    const res = parseModels(JSON.stringify([def, { id: "junk" }, "str"]));
    expect(res.models).toHaveLength(1);
    expect(res.rejected).toBe(2);
    expect(modelDef("ai_test1")).not.toBeNull();
    expect(parseModels("{oops").models).toEqual([]);
    unregisterModel("ai_test1");
  });
});
