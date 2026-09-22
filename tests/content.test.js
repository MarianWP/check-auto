import { describe, it, expect } from "vitest";
import { itemFromRow, rowFromForm, photoFromRow, photosFor, STAGE_IDS } from "../src/logic/content";
import { checklistFor, visibleStages, computeReport } from "../src/logic/report";
import CL from "../src/data/checklist";
import { CFG, OCTAVIA_CFG, mkInsp } from "./helpers";

const row = over => Object.assign({ id: "11111111-2222-3333-4444-555555555555", model: null, stage: "engine", title: "Немає підтікань під помпою", how: "Подивись на помпу з ліхтариком", why: "Помпа тече — антифриз у масло", sev: "major", cost_lo: 100, cost_hi: 250, tags: ["тече", "сліди"], only_tags: [], sort: 10, enabled: true }, over);

describe("власні пункти з адмінки → пункт чек-листа", () => {
  it("рядок бази перетворюється у пункт з id c_<uuid>, вартістю і тегами", () => {
    const it = itemFromRow(row());
    expect(it.id).toBe("c_11111111-2222-3333-4444-555555555555");
    expect(it.custom).toBe(true);
    expect(it.cost).toEqual([100, 250]);
    expect(it.tags).toEqual(["тече", "сліди"]);
    expect(it.only).toBeUndefined();
    expect(it.sev).toBe("major");
  });

  it("сміття у рядку не ламає: невідомий етап або порожня назва → null, дивна вага → major", () => {
    expect(itemFromRow(row({ stage: "nope" }))).toBeNull();
    expect(itemFromRow(row({ title: "  " }))).toBeNull();
    expect(itemFromRow(row({ sev: "urgent" })).sev).toBe("major");
    expect(itemFromRow(row({ cost_lo: 300, cost_hi: 100 })).cost).toEqual([100, 300]);
    expect(itemFromRow(row({ cost_lo: null, cost_hi: null })).cost).toBeUndefined();
    expect(itemFromRow(row({ tags: "a, b ,, c" })).tags).toEqual(["a", "b", "c"]);
  });

  it("форма → рядок: валідація і нормалізація", () => {
    expect(rowFromForm({ title: "", how: "x", stage: "engine" }).error).toMatch(/назву/);
    expect(rowFromForm({ title: "x", how: "", stage: "engine" }).error).toMatch(/як перевірити/);
    expect(rowFromForm({ title: "x", how: "y", stage: "zzz" }).error).toMatch(/етап/);
    expect(rowFromForm({ title: "x", how: "y", stage: "engine", cost_lo: "100", cost_hi: "" }).error).toMatch(/Вартість/);
    const { row: r } = rowFromForm({ title: " Пункт ", how: "Як", stage: "engine", sev: "crit", cost_lo: "300", cost_hi: "100", tags: "тече, шум", only_tags: "diesel", sort: "5", enabled: false, model: "" });
    expect(r).toEqual({ model: null, stage: "engine", title: "Пункт", how: "Як", why: "", sev: "crit", cost_lo: 300, cost_hi: 300, tags: ["тече", "шум"], only_tags: ["diesel"], sort: 5, enabled: false });
  });

  it("STAGE_IDS збігається з етапами чек-листа", () => {
    expect(STAGE_IDS).toEqual(CL.map(s => s.id));
  });
});

describe("злиття власних пунктів у чек-лист", () => {
  const extra = [
    itemFromRow(row()),
    itemFromRow(row({ id: "22222222-2222-3333-4444-555555555555", model: "octavia5", stage: "body", title: "Іржа кришки багажника" })),
    itemFromRow(row({ id: "33333333-2222-3333-4444-555555555555", stage: "body", title: "Лише дизель", only_tags: ["diesel"] })),
    itemFromRow(row({ id: "44444444-2222-3333-4444-555555555555", stage: "body", title: "Вимкнений", enabled: false }))
  ];

  it("пункт для всіх моделей додається в кінець етапу, пункт іншої моделі — ні, вимкнений — ні", () => {
    const stages = checklistFor(mkInsp(CFG), CL, extra);
    const engine = stages.find(s => s.id === "engine"), body = stages.find(s => s.id === "body");
    expect(engine.items[engine.items.length - 1].id).toBe("c_11111111-2222-3333-4444-555555555555");
    expect(body.items.map(it => it.t)).not.toContain("Іржа кришки багажника");
    expect(body.items.map(it => it.t)).not.toContain("Вимкнений");
    expect(body.items.map(it => it.t)).toContain("Лише дизель");
  });

  it("пункт моделі Octavia видно лише в оглядах Octavia", () => {
    const o = checklistFor(mkInsp(OCTAVIA_CFG, {}, "octavia5"), CL, extra).find(s => s.id === "body");
    expect(o.items.map(it => it.t)).toContain("Іржа кришки багажника");
  });

  it("only на власному пункті працює як на вбудованих: бензин не бачить дизельний пункт", () => {
    const visible = visibleStages(mkInsp(CFG), CL, extra).find(s => s.id === "body").items.map(it => it.t);
    expect(visible).not.toContain("Лише дизель");
  });

  it("власний пункт бере участь у звіті: критична проблема на ньому дає «Не рекомендуємо»", () => {
    const crit = [itemFromRow(row({ id: "55555555-2222-3333-4444-555555555555", sev: "crit", title: "Власний критичний" }))];
    const rep = computeReport(mkInsp(CFG, { "c_55555555-2222-3333-4444-555555555555": { s: "bad" } }), CL, crit);
    expect(rep.verdict).toBe("no");
    expect(rep.fails.crit[0].it.custom).toBe(true);
    expect(rep.total).toBe(computeReport(mkInsp(CFG)).total + 1);
  });

  it("без власних пунктів чек-лист той самий об'єкт", () => {
    expect(checklistFor(mkInsp(CFG), CL, [])).toBe(CL);
  });
});

describe("фото до проблем", () => {
  it("рядок фото → запис з ключем; вибірка за видом, ціллю, індексом і моделлю", () => {
    const list = [
      photoFromRow({ id: "p1", kind: "engine", target: "tdi105", idx: 2, path: "engine/tdi105/a.jpg", caption: "Сажа" }),
      photoFromRow({ id: "p2", kind: "engine", target: "tdi105", idx: 0, path: "engine/tdi105/b.jpg" }),
      photoFromRow({ id: "p3", kind: "common", model: "golf5", target: "golf5", idx: 1, path: "common/golf5/c.jpg" }),
      photoFromRow({ id: "p4", kind: "weird", target: "x", path: "x" })
    ].filter(Boolean);
    expect(list).toHaveLength(3);
    expect(photosFor(list, "engine", "tdi105", 2).map(p => p.id)).toEqual(["p1"]);
    expect(photosFor(list, "engine", "tdi105", 0).map(p => p.id)).toEqual(["p2"]);
    expect(photosFor(list, "common", "golf5", 1, "golf5").map(p => p.id)).toEqual(["p3"]);
    expect(photosFor(list, "common", "golf5", 1, "octavia5")).toEqual([]);
    expect(photosFor(list, "item", "docs_vin", 0)).toEqual([]);
  });
});
