import { describe, it, expect } from "vitest";
import { modelApi, MODELS, ENGINE_LIB, GEARBOXES } from "../src/data/index.js";
import CL from "../src/data/checklist";
import { visibleStages } from "../src/logic/report";
import { allConfigs, mkInsp } from "./helpers";

const ALL_ITEMS = CL.flatMap(s => s.items);
const TAG_UNIVERSE = new Set([...Object.values(ENGINE_LIB).flatMap(e => e.tags), ...GEARBOXES.flatMap(g => g.tags)]);

describe("цілісність чек-листа", () => {
  it("етапи мають id, назви, вступ і пункти", () => {
    expect(CL.length).toBeGreaterThanOrEqual(10);
    CL.forEach(s => {
      expect(s.id, "stage id").toBeTruthy();
      expect(s.name && s.short && s.intro, s.id).toBeTruthy();
      expect(s.items.length, s.id).toBeGreaterThan(0);
    });
    expect(new Set(CL.map(s => s.id)).size).toBe(CL.length);
  });

  it("id пунктів унікальні", () => {
    const ids = ALL_ITEMS.map(it => it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("кожен пункт має текст, пояснення і коректну вагу", () => {
    ALL_ITEMS.forEach(it => {
      expect(it.t && it.how && it.why, it.id).toBeTruthy();
      expect(["crit", "major", "minor"], it.id).toContain(it.sev);
    });
  });

  it("вартість — пара [від, до], від <= до", () => {
    ALL_ITEMS.filter(it => it.cost).forEach(it => {
      expect(it.cost, it.id).toHaveLength(2);
      expect(it.cost[0], it.id).toBeGreaterThanOrEqual(0);
      expect(it.cost[0], it.id).toBeLessThanOrEqual(it.cost[1]);
    });
  });

  it("теги в only і notes існують у бібліотеці моторів і коробок", () => {
    ALL_ITEMS.forEach(it => {
      (it.only || []).forEach(t => expect(TAG_UNIVERSE.has(t), it.id + " only:" + t).toBe(true));
      Object.keys(it.notes || {}).forEach(t => expect(TAG_UNIVERSE.has(t), it.id + " notes:" + t).toBe(true));
    });
  });

  it("швидкі теги проблеми — непорожні рядки", () => {
    ALL_ITEMS.filter(it => it.tags).forEach(it => {
      expect(Array.isArray(it.tags), it.id).toBe(true);
      it.tags.forEach(t => expect(typeof t === "string" && t.length > 0, it.id).toBe(true));
    });
  });
});

describe("фільтрація чек-листа під конфігурацію", () => {
  MODELS.forEach(m => {
    const G = modelApi(m.id), CONFIGS = allConfigs(m.id);
    it(m.name + ": пункт з only видно лише коли всі його теги є в конфігурації; без only — завжди", () => {
      CONFIGS.forEach(cfg => {
        const tags = G.tagsFor(cfg);
        const visible = new Set(visibleStages(mkInsp(cfg, {}, m.id)).flatMap(s => s.items).map(it => it.id));
        ALL_ITEMS.forEach(it => {
          const expected = !it.only || it.only.every(t => tags.has(t));
          expect(visible.has(it.id), m.id + " " + JSON.stringify(cfg) + " " + it.id).toBe(expected);
        });
      });
    });
    it(m.name + ": у будь-якій конфігурації кожен етап непорожній і є критичні пункти", () => {
      CONFIGS.forEach(cfg => {
        const stages = visibleStages(mkInsp(cfg, {}, m.id));
        stages.forEach(s => expect(s.items.length, JSON.stringify(cfg) + " " + s.id).toBeGreaterThan(0));
        expect(stages.flatMap(s => s.items).filter(it => it.sev === "crit").length).toBeGreaterThanOrEqual(10);
      });
    });
  });

  it("немає «мертвих» пунктів: кожен умовний пункт видно хоча б в одній конфігурації Golf V", () => {
    const G = modelApi("golf5"), CONFIGS = allConfigs("golf5");
    ALL_ITEMS.filter(it => it.only).forEach(it => {
      const seen = CONFIGS.some(cfg => { const tags = G.tagsFor(cfg); return it.only.every(t => tags.has(t)); });
      expect(seen, it.id + " only:" + it.only.join(",")).toBe(true);
    });
  });

  it("дизель не бачить суто бензинових пунктів, механіка — пунктів DSG й автомата", () => {
    const G = modelApi("golf5"), CONFIGS = allConfigs("golf5");
    const petrolOnly = ALL_ITEMS.filter(it => it.only && it.only.includes("petrol")).map(it => it.id);
    const autoOnly = ALL_ITEMS.filter(it => it.only && (it.only.includes("dsg") || it.only.includes("at"))).map(it => it.id);
    const diesel = CONFIGS.find(c => G.engine(c.engine).fuel === "diesel");
    const manual = CONFIGS.find(c => G.gearbox(c.gear).tags.includes("manual"));
    const ids = cfg => visibleStages(mkInsp(cfg)).flatMap(s => s.items).map(it => it.id);
    petrolOnly.forEach(id => expect(ids(diesel)).not.toContain(id));
    autoOnly.forEach(id => expect(ids(manual)).not.toContain(id));
  });

  it("фільтрація не змінює вихідний чек-лист", () => {
    const before = ALL_ITEMS.length;
    visibleStages(mkInsp(allConfigs()[0]));
    expect(CL.flatMap(s => s.items).length).toBe(before);
  });
});
