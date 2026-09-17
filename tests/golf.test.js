import { describe, it, expect } from "vitest";
import G from "../src/data/golf";
import { allConfigs } from "./helpers";

describe("довідник: мотори, кузови, коробки", () => {
  it("id унікальні", () => {
    [G.ENGINES, G.BODIES, G.GEARBOXES].forEach(list => expect(new Set(list.map(x => x.id)).size).toBe(list.length));
  });

  it("кожен мотор посилається на наявні кузови й коробки та має коректні поля", () => {
    G.ENGINES.forEach(e => {
      expect(["petrol", "diesel"], e.id).toContain(e.fuel);
      expect(e.tags, e.id).toContain(e.fuel);
      expect(e.years[0], e.id).toBeLessThanOrEqual(e.years[1]);
      expect(e.price[0], e.id).toBeLessThan(e.price[1]);
      expect(e.reliability, e.id).toBeGreaterThanOrEqual(1);
      expect(e.reliability, e.id).toBeLessThanOrEqual(5);
      expect(["ok", "hard", "no"], e.id).toContain(e.lpg);
      expect(e.bodies.length && e.gears.length, e.id).toBeTruthy();
      e.bodies.forEach(b => expect(G.body(b), e.id + " body " + b).toBeTruthy());
      e.gears.forEach(g => expect(G.gearbox(g), e.id + " gear " + g).toBeTruthy());
      e.issues.forEach(x => expect(x.t && x.d, e.id).toBeTruthy());
    });
  });

  it("коробки й кузови мають коефіцієнт ціни й теги/роки", () => {
    G.GEARBOXES.forEach(g => { expect(g.factor, g.id).toBeGreaterThan(0); expect(g.tags.length, g.id).toBeGreaterThan(0); });
    G.BODIES.forEach(b => { expect(b.factor, b.id).toBeGreaterThan(0); expect(b.years[0], b.id).toBeLessThanOrEqual(b.years[1]); });
  });
});

describe("сумісність конфігурацій", () => {
  it("для кожної пари мотор–кузов є роки, і вони в межах обох діапазонів", () => {
    G.ENGINES.forEach(e => e.bodies.forEach(b => {
      const years = G.yearsFor(e.id, b), body = G.body(b);
      expect(years.length, e.id + "/" + b).toBeGreaterThan(0);
      years.forEach(y => {
        expect(y >= e.years[0] && y <= e.years[1], e.id + " " + y).toBe(true);
        expect(y >= body.years[0] && y <= body.years[1], b + " " + y).toBe(true);
      });
    }));
  });

  it("для кожного року є хоча б одна коробка, DSG-7 не раніше 2008", () => {
    G.ENGINES.forEach(e => e.bodies.forEach(b => G.yearsFor(e.id, b).forEach(y => {
      const gears = G.gearsFor(e.id, y);
      expect(gears.length, e.id + " " + y).toBeGreaterThan(0);
      gears.forEach(g => expect(e.gears, e.id).toContain(g.id));
      if (y < 2008) expect(gears.map(g => g.id)).not.toContain("dsg7");
    })));
  });

  it("невідомі id не ламають помічники", () => {
    expect(G.yearsFor("nope", "h5")).toEqual([]);
    expect(G.gearsFor("nope", 2006)).toEqual([]);
    expect(G.priceFor({ engine: "nope" })).toBeNull();
    expect(G.tagsFor({ engine: "nope", gear: "nope" }).size).toBe(0);
  });

  it("ціна додатна, від < до, і не падає з новішим роком", () => {
    allConfigs().forEach(cfg => {
      const p = G.priceFor(cfg);
      expect(p.lo, JSON.stringify(cfg)).toBeGreaterThan(0);
      expect(p.lo, JSON.stringify(cfg)).toBeLessThan(p.hi);
      const older = G.priceFor(Object.assign({}, cfg, { year: cfg.year - 1 }));
      expect(p.hi).toBeGreaterThanOrEqual(older.hi);
    });
  });

  it("теги конфігурації = теги мотора + теги коробки, назва непорожня", () => {
    allConfigs().forEach(cfg => {
      const expected = new Set([...G.engine(cfg.engine).tags, ...G.gearbox(cfg.gear).tags]);
      expect(G.tagsFor(cfg)).toEqual(expected);
      expect(G.label(cfg)).toContain(String(cfg.year));
    });
  });
});
