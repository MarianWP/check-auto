import { describe, it, expect } from "vitest";
import { buildContext, suggestions, messageFromRow, MAX_CONTEXT } from "../src/logic/assistant";
import { computeReport, visibleStages } from "../src/logic/report";
import { modelApi } from "../src/data/index.js";
import { CFG, OCTAVIA_CFG, mkInsp, answersBy } from "./helpers";

const G = modelApi("golf5");

describe("контекст огляду для помічника", () => {
  it("містить авто, двигун, коробку, ціни, стан огляду і проблеми з коментарем", () => {
    const answers = answersBy(CFG, (it, k) => (k === 0 ? "bad" : k < 30 ? "ok" : ""));
    const i = mkInsp(CFG, answers); i.price = 5000; i.name = "Синій";
    const firstId = Object.keys(answers)[0]; answers[firstId].c = "Власник у техпаспорті інший"; answers[firstId].tags = ["дублікат"];
    const rep = computeReport(i);
    const ctx = buildContext({ i, G, rep, stages: visibleStages(i), verdict: "Не рекомендуємо" });
    expect(ctx).toContain("Volkswagen Golf V (1K)");
    expect(ctx).toContain("(Синій)");
    expect(ctx).toContain("Ціна продавця: $5000");
    expect(ctx).toMatch(/Ринковий діапазон.*\$\d+–\d+/);
    expect(ctx).toContain("Двигун " + G.engine("mpi14").name);
    expect(ctx).toContain("Коробка " + G.gearbox("m5").name);
    expect(ctx).toContain("Хвороби моделі:");
    expect(ctx).toContain("Не рекомендуємо");
    expect(ctx).toContain("(дублікат). Коментар користувача: Власник у техпаспорті інший");
    expect(ctx).toContain("Критичні пункти ще без перевірки:");
  });

  it("поточний етап додає перелік його пунктів", () => {
    const i = mkInsp(CFG);
    const ctx = buildContext({ i, G, rep: computeReport(i), stages: visibleStages(i), stageNow: "engine" });
    expect(ctx).toContain("на етапі «");
    expect(ctx).toContain("Пункти етапу:");
  });

  it("без огляду — порожньо; довжина обмежена", () => {
    expect(buildContext({})).toBe("");
    const i = mkInsp(CFG, answersBy(CFG, () => "bad"));
    Object.values(i.answers).forEach(a => { a.c = "к".repeat(500); });
    const ctx = buildContext({ i, G, rep: computeReport(i), stages: visibleStages(i) });
    expect(ctx.length).toBeLessThanOrEqual(MAX_CONTEXT);
  });

  it("працює для іншої моделі", () => {
    const O = modelApi("octavia5"), i = mkInsp(OCTAVIA_CFG, {}, "octavia5");
    expect(buildContext({ i, G: O, rep: computeReport(i) })).toContain("Octavia");
  });
});

describe("підказки й повідомлення", () => {
  it("з оглядом підказки про це авто, з DSG — про DSG; без огляду — загальні", () => {
    const dsg = { engine: "tsi122", body: "h5", year: 2009, gear: "dsg7" };
    expect(suggestions(mkInsp(dsg), G).some(s => /DSG/.test(s))).toBe(true);
    expect(suggestions(mkInsp(CFG), G).some(s => /DSG/.test(s))).toBe(false);
    expect(suggestions(null).length).toBeGreaterThanOrEqual(3);
    suggestions(mkInsp(CFG), G).forEach(s => expect(s.length).toBeLessThan(80));
  });
  it("рядок бази → повідомлення, сміття → null", () => {
    expect(messageFromRow({ id: "1", role: "user", content: "Привіт", created_at: "2026-09-23T10:00:00Z" })).toEqual({ id: "1", role: "user", content: "Привіт", at: Date.parse("2026-09-23T10:00:00Z") });
    expect(messageFromRow({ role: "system", content: "x" })).toBeNull();
    expect(messageFromRow(null)).toBeNull();
  });
});
