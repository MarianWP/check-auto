import { describe, it, expect } from "vitest";
import { MODELS, modelApi, modelDef, modelIdOf, apiOf, DEFAULT_MODEL, ENGINE_LIB, GEARBOXES } from "../src/data/index.js";
import { allConfigs } from "./helpers";

describe("реєстр моделей", () => {
  it("є Golf V як типова модель і хоча б одна інша", () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(2);
    expect(modelDef(DEFAULT_MODEL).id).toBe("golf5");
    expect(new Set(MODELS.map(m => m.id)).size).toBe(MODELS.length);
  });

  it("невідома або відсутня модель запису → типова, невідомий id → typowe API", () => {
    expect(modelIdOf({})).toBe(DEFAULT_MODEL);
    expect(modelIdOf({ model: "lada" })).toBe(DEFAULT_MODEL);
    expect(modelIdOf({ model: "octavia5" })).toBe("octavia5");
    expect(modelApi("nope").id).toBe(DEFAULT_MODEL);
    expect(apiOf({ model: "octavia5" }).id).toBe("octavia5");
    expect(modelDef("nope")).toBeNull();
  });

  it("кожна модель має обов'язкові поля, а посилання на двигуни — у бібліотеці", () => {
    MODELS.forEach(m => {
      expect(m.brand && m.name && m.short && m.full, m.id).toBeTruthy();
      expect(m.years[0], m.id).toBeLessThanOrEqual(m.years[1]);
      expect(typeof m.draft, m.id).toBe("boolean");
      expect(m.market && m.market.avg > 0 && m.market.search, m.id).toBeTruthy();
      expect(m.bodies.length && m.engines.length && m.common.length && m.trims.length && m.kit.length, m.id).toBeTruthy();
      expect(m.vin && m.vin.rows.length && m.vin.places.length && m.plants.length, m.id).toBeTruthy();
      m.engines.forEach(ref => {
        expect(ENGINE_LIB[ref.id], m.id + " engine " + ref.id).toBeTruthy();
        expect(ref.years[0], ref.id).toBeLessThanOrEqual(ref.years[1]);
        expect(ref.years[0] >= m.years[0] && ref.years[1] <= m.years[1], m.id + " " + ref.id + " роки поза моделлю").toBe(true);
        expect(ref.price[0], ref.id).toBeLessThan(ref.price[1]);
        ref.bodies.forEach(b => expect(m.bodies.some(x => x.id === b), m.id + " " + ref.id + " body " + b).toBe(true));
        ref.gears.forEach(g => expect(GEARBOXES.some(x => x.id === g), ref.id + " gear " + g).toBe(true));
      });
      m.bodies.forEach(b => { expect(b.factor, b.id).toBeGreaterThan(0); expect(b.years[0], b.id).toBeLessThanOrEqual(b.years[1]); });
      m.common.forEach(x => { expect(x.t && x.d, m.id).toBeTruthy(); expect(x.cost[0], x.t).toBeLessThanOrEqual(x.cost[1]); });
    });
  });
});

describe("бібліотека двигунів і коробок", () => {
  it("двигуни: паливо, теги, надійність, ГБО, проблеми", () => {
    Object.entries(ENGINE_LIB).forEach(([id, e]) => {
      expect(["petrol", "diesel"], id).toContain(e.fuel);
      expect(e.tags, id).toContain(e.fuel);
      expect(e.reliability >= 1 && e.reliability <= 5, id).toBe(true);
      expect(["ok", "hard", "no"], id).toContain(e.lpg);
      expect(e.name && e.hp && e.codes && e.summary && e.verdict && e.timing && e.timing.text, id).toBeTruthy();
      e.issues.forEach(x => expect(x.t && x.d, id).toBeTruthy());
    });
  });
  it("коробки мають коефіцієнт ціни й теги; id унікальні", () => {
    expect(new Set(GEARBOXES.map(g => g.id)).size).toBe(GEARBOXES.length);
    GEARBOXES.forEach(g => { expect(g.factor, g.id).toBeGreaterThan(0); expect(g.tags.length, g.id).toBeGreaterThan(0); });
  });
});

describe("сумісність конфігурацій для кожної моделі", () => {
  MODELS.forEach(m => {
    const G = modelApi(m.id);
    it(m.name + ": для кожної пари мотор–кузов є роки в межах обох діапазонів", () => {
      G.ENGINES.forEach(e => e.bodies.forEach(b => {
        const years = G.yearsFor(e.id, b), body = G.body(b);
        expect(years.length, e.id + "/" + b).toBeGreaterThan(0);
        years.forEach(y => {
          expect(y >= e.years[0] && y <= e.years[1], e.id + " " + y).toBe(true);
          expect(y >= body.years[0] && y <= body.years[1], b + " " + y).toBe(true);
        });
      }));
    });
    it(m.name + ": для кожного року є коробка, DSG-7 не раніше дозволеного року", () => {
      const min = (m.gearMinYear || {}).dsg7;
      G.ENGINES.forEach(e => e.bodies.forEach(b => G.yearsFor(e.id, b).forEach(y => {
        const gears = G.gearsFor(e.id, y);
        expect(gears.length, e.id + " " + y).toBeGreaterThan(0);
        gears.forEach(g => expect(e.gears, e.id).toContain(g.id));
        if (min && y < min) expect(gears.map(g => g.id)).not.toContain("dsg7");
      })));
    });
    it(m.name + ": ціна додатна, від < до, не падає з новішим роком; теги = мотор + коробка; назва містить рік", () => {
      allConfigs(m.id).forEach(cfg => {
        const p = G.priceFor(cfg);
        expect(p.lo, JSON.stringify(cfg)).toBeGreaterThan(0);
        expect(p.lo, JSON.stringify(cfg)).toBeLessThan(p.hi);
        expect(p.hi).toBeGreaterThanOrEqual(G.priceFor(Object.assign({}, cfg, { year: cfg.year - 1 })).hi);
        expect(G.tagsFor(cfg)).toEqual(new Set([...ENGINE_LIB[cfg.engine].tags, ...G.gearbox(cfg.gear).tags]));
        expect(G.label(cfg)).toContain(String(cfg.year));
      });
    });
  });

  it("невідомі id не ламають помічники", () => {
    const G = modelApi("golf5");
    expect(G.yearsFor("nope", "h5")).toEqual([]);
    expect(G.gearsFor("nope", 2006)).toEqual([]);
    expect(G.priceFor({ engine: "nope" })).toBeNull();
    expect(G.tagsFor({ engine: "nope", gear: "nope" }).size).toBe(0);
  });

  it("Golf V: кузов h3 не існує в Octavia, а конфігурація Octavia — не в Golf V", () => {
    expect(modelApi("octavia5").body("h3")).toBeUndefined();
    expect(modelApi("golf5").body("combi")).toBeUndefined();
  });
});
