import { describe, it, expect } from "vitest";
import { validConfig, normalizeInspection, normalizeList, parseState, makeBackup, parseBackup, mergeInspections, BACKUP_APP } from "../src/logic/storage";
import { CFG, mkInsp, allConfigs } from "./helpers";

const NOW = 5000;

describe("перевірка конфігурації", () => {
  it("усі конфігурації з конфігуратора валідні", () => {
    allConfigs().forEach(cfg => expect(validConfig(cfg), JSON.stringify(cfg)).toBe(true));
  });

  it("невідомий мотор, чужий кузов, рік поза діапазоном, несумісна коробка → невалідно", () => {
    expect(validConfig(Object.assign({}, CFG, { engine: "v12" }))).toBe(false);
    expect(validConfig(Object.assign({}, CFG, { body: "variant" }))).toBe(false);
    expect(validConfig(Object.assign({}, CFG, { year: 1999 }))).toBe(false);
    expect(validConfig(Object.assign({}, CFG, { year: "2003" }))).toBe(false);
    expect(validConfig(Object.assign({}, CFG, { gear: "dsg7" }))).toBe(false);
    expect(validConfig(null)).toBe(false);
  });
});

describe("нормалізація запису перевірки", () => {
  it("коректний запис зберігається без змін по суті", () => {
    const raw = mkInsp(CFG, { a1: { s: "bad", tags: ["іржа"], c: "поріг" }, a2: { s: "ok" } });
    raw.name = "Синій"; raw.price = 6500; raw.stage = 3; raw.done = true;
    expect(normalizeInspection(raw, NOW)).toEqual(raw);
  });

  it("сміття у відповідях вичищається, а не ламає запис", () => {
    const raw = mkInsp(CFG, {
      ok1: { s: "ok", extra: 1 },
      weird: { s: "maybe", c: "коментар лишається" },
      tagsBad: { s: "bad", tags: "не масив" },
      tagsMixed: { s: "bad", tags: ["a", 5, "", "b"] },
      long: { s: "bad", c: "x".repeat(900) },
      empty: {},
      notObj: "рядок"
    });
    const n = normalizeInspection(raw, NOW);
    expect(n.answers.ok1).toEqual({ s: "ok" });
    expect(n.answers.weird).toEqual({ s: "", c: "коментар лишається" });
    expect(n.answers.tagsBad).toEqual({ s: "bad" });
    expect(n.answers.tagsMixed.tags).toEqual(["a", "b"]);
    expect(n.answers.long.c).toHaveLength(500);
    expect(n.answers).not.toHaveProperty("empty");
    expect(n.answers).not.toHaveProperty("notObj");
  });

  it("небезпечні ключі ігноруються, прототип не забруднюється", () => {
    const raw = JSON.parse('{"id":"x1","cfg":' + JSON.stringify(CFG) + ',"answers":{"__proto__":{"s":"ok","polluted":true},"constructor":{"s":"ok"}}}');
    const n = normalizeInspection(raw, NOW);
    expect(Object.keys(n.answers)).toEqual([]);
    expect({}.polluted).toBeUndefined();
  });

  it("відсутні поля отримують безпечні значення", () => {
    const n = normalizeInspection({ id: "x2", cfg: CFG }, NOW);
    expect(n).toEqual({ id: "x2", createdAt: NOW, updatedAt: NOW, name: "", price: 0, cfg: CFG, answers: {}, stage: 0, done: false });
  });

  it("без id або з невідомою конфігурацією запис відкидається", () => {
    expect(normalizeInspection({ cfg: CFG }, NOW)).toBeNull();
    expect(normalizeInspection({ id: "x", cfg: { engine: "v12", body: "h5", year: 2006, gear: "m5" } }, NOW)).toBeNull();
    expect(normalizeInspection("рядок", NOW)).toBeNull();
    expect(normalizeInspection(null, NOW)).toBeNull();
  });

  it("дублікати id: лишається новіший запис", () => {
    const a = Object.assign(mkInsp(), { id: "dup", updatedAt: 10, name: "старий" });
    const b = Object.assign(mkInsp(), { id: "dup", updatedAt: 20, name: "новий" });
    const res = normalizeList([a, b, { id: "bad" }], NOW);
    expect(res.inspections).toHaveLength(1);
    expect(res.inspections[0].name).toBe("новий");
    expect(res.rejected).toBe(1);
  });
});

describe("читання збереженого стану", () => {
  it("порожнє сховище — не помилка", () => {
    expect(parseState(null)).toEqual({ state: { inspections: [], hideInstall: false }, rejected: 0, error: null });
  });

  it("битий JSON і чужа структура дають помилку, а не виняток", () => {
    expect(parseState("{oops").error).toBe("parse");
    expect(parseState('{"inspections":"ні"}').error).toBe("shape");
    expect(parseState("[1,2]").error).toBe("shape");
  });

  it("придатні записи завантажуються, непридатні рахуються", () => {
    const text = JSON.stringify({ inspections: [mkInsp(), { id: "z", cfg: { engine: "v12" } }], hideInstall: true });
    const res = parseState(text, NOW);
    expect(res.error).toBeNull();
    expect(res.state.inspections).toHaveLength(1);
    expect(res.state.hideInstall).toBe(true);
    expect(res.rejected).toBe(1);
  });
});

describe("резервна копія", () => {
  it("експорт → імпорт повертає ті самі перевірки", () => {
    const list = [mkInsp(CFG, { a1: { s: "bad", c: "іржа" } }), Object.assign(mkInsp(), { id: "t2", name: "Другий" })];
    const backup = makeBackup(list, NOW);
    expect(backup.app).toBe(BACKUP_APP);
    const res = parseBackup(JSON.stringify(backup), NOW);
    expect(res.inspections).toEqual(list);
    expect(res.rejected).toBe(0);
  });

  it("сирий стан зі сховища теж приймається як копія", () => {
    const res = parseBackup(JSON.stringify({ inspections: [mkInsp()], hideInstall: false }), NOW);
    expect(res.inspections).toHaveLength(1);
  });

  it("не JSON, чужий застосунок і новіша версія формату відхиляються зі зрозумілим текстом", () => {
    expect(() => parseBackup("привіт")).toThrow(/JSON/);
    expect(() => parseBackup('{"foo":1}')).toThrow(/немає списку/);
    expect(() => parseBackup('{"app":"other","inspections":[]}')).toThrow(/іншого застосунку/);
    expect(() => parseBackup('{"app":"golf-check","version":99,"inspections":[]}')).toThrow(/новішою версією/);
  });

  it("злиття: нові додаються, новіші оновлюють, старіші пропускаються, наявні не зникають", () => {
    const cur = [Object.assign(mkInsp(), { id: "a", updatedAt: 100, name: "A" }), Object.assign(mkInsp(), { id: "b", updatedAt: 100, name: "B" })];
    const inc = [
      Object.assign(mkInsp(), { id: "a", updatedAt: 200, name: "A новіший" }),
      Object.assign(mkInsp(), { id: "b", updatedAt: 50, name: "B старіший" }),
      Object.assign(mkInsp(), { id: "c", updatedAt: 10, name: "C" })
    ];
    const res = mergeInspections(cur, inc);
    expect({ added: res.added, updated: res.updated, skipped: res.skipped }).toEqual({ added: 1, updated: 1, skipped: 1 });
    const names = Object.fromEntries(res.list.map(i => [i.id, i.name]));
    expect(names).toEqual({ a: "A новіший", b: "B", c: "C" });
    expect(cur.map(i => i.name)).toEqual(["A", "B"]);
  });
});
