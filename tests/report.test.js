import { describe, it, expect } from "vitest";
import { computeReport, stageProgress, visibleStages, MIN_DATA, FULL_COVERAGE } from "../src/logic/report";
import { CFG, mkInsp, items, answersBy } from "./helpers";

const report = answers => computeReport(mkInsp(CFG, answers));
const ALL = items();
const CRIT = ALL.filter(it => it.sev === "crit");
const REST = ALL.filter(it => it.sev !== "crit");

describe("вердикт і повнота огляду", () => {
  it("нічого не перевірено → «Недостатньо даних», оцінка 0", () => {
    const r = report({});
    expect(r.verdict).toBe("nodata");
    expect(r.score).toBe(0);
    expect(r.answered).toBe(0);
    expect(r.critUnchecked.length).toBe(r.critTotal);
  });

  it("41 % відповідей «ок» не дає позитивного вердикту (сценарій «42 зі 103»)", () => {
    const n = Math.ceil(ALL.length * 0.41);
    const r = report(answersBy(CFG, (it, k) => (k < n ? "ok" : "")));
    expect(r.coverage).toBeGreaterThanOrEqual(MIN_DATA);
    expect(r.score).toBe(100);
    expect(r.complete).toBe(false);
    expect(r.verdict).toBe("partial");
  });

  it("усе «ок» → «Можна брати», огляд повний", () => {
    const r = report(answersBy(CFG, () => "ok"));
    expect(r.verdict).toBe("good");
    expect(r.complete).toBe(true);
    expect(r.coverage).toBe(1);
    expect(r.critUnchecked).toHaveLength(0);
  });

  it("рівно поріг повноти з усіма критичними → позитивний вердикт, на один пункт менше → «Огляд неповний»", () => {
    const need = Math.ceil(ALL.length * FULL_COVERAGE);
    const order = CRIT.concat(REST);
    const take = n => { const a = {}; order.slice(0, n).forEach(it => { a[it.id] = { s: "ok" }; }); return a; };
    expect(report(take(need)).verdict).toBe("good");
    expect(report(take(need - 1)).verdict).toBe("partial");
  });

  it("повнота достатня, але критичний пункт пропущено → «Огляд неповний»", () => {
    const a = answersBy(CFG, () => "ok");
    a[CRIT[0].id] = { s: "skip" };
    const r = report(a);
    expect(r.coverage).toBeGreaterThanOrEqual(FULL_COVERAGE);
    expect(r.critUnchecked.map(x => x.it.id)).toEqual([CRIT[0].id]);
    expect(r.verdict).toBe("partial");
  });

  it("«пропустити» не додає повноти: усе пропущено → «Недостатньо даних»", () => {
    const r = report(answersBy(CFG, () => "skip"));
    expect(r.answered).toBe(0);
    expect(r.answeredAll).toBe(ALL.length);
    expect(r.verdict).toBe("nodata");
  });
});

describe("критичний дефект визначає вердикт одразу", () => {
  it("єдина відповідь — критична проблема → «Не рекомендуємо», а не «Недостатньо даних»", () => {
    const r = report({ [CRIT[0].id]: { s: "bad" } });
    expect(r.coverage).toBeLessThan(MIN_DATA);
    expect(r.fails.crit).toHaveLength(1);
    expect(r.verdict).toBe("no");
  });

  it("критичний дефект переважує і при повному огляді з рештою «ок»", () => {
    const a = answersBy(CFG, () => "ok");
    a[CRIT[0].id] = { s: "bad" };
    const r = report(a);
    expect(r.verdict).toBe("no");
    expect(r.score).toBeLessThanOrEqual(75);
  });
});

describe("оцінка, торг і бюджет", () => {
  it("повний огляд із двома важливими дефектами → «Брати з торгом»", () => {
    const majors = ALL.filter(it => it.sev === "major").slice(0, 2).map(it => it.id);
    const r = report(answersBy(CFG, it => (majors.includes(it.id) ? "bad" : "ok")));
    expect(r.fails.major).toHaveLength(2);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.verdict).toBe("bargain");
  });

  it("низька оцінка → «Не рекомендуємо» навіть без критичних дефектів", () => {
    const r = report(answersBy(CFG, it => (it.sev === "crit" ? "ok" : "bad")));
    expect(r.fails.crit).toHaveLength(0);
    expect(r.score).toBeLessThan(65);
    expect(r.verdict).toBe("no");
  });

  it("небагато відповідей без критичних дефектів → «Недостатньо даних», знайдені проблеми пораховано", () => {
    const minor = ALL.find(it => it.sev === "minor");
    const r = report({ [minor.id]: { s: "bad" } });
    expect(r.verdict).toBe("nodata");
    expect(r.failCount).toBe(1);
  });

  it("бюджет — сума вартостей лише проблемних пунктів", () => {
    const withCost = ALL.filter(it => it.cost && it.cost[1] > 0).slice(0, 3);
    const a = answersBy(CFG, () => "ok");
    withCost.forEach(it => { a[it.id] = { s: "bad" }; });
    const r = report(a);
    expect(r.cost.lo).toBe(withCost.reduce((s, it) => s + it.cost[0], 0));
    expect(r.cost.hi).toBe(withCost.reduce((s, it) => s + it.cost[1], 0));
    expect(report(answersBy(CFG, () => "ok")).cost).toEqual({ lo: 0, hi: 0 });
  });

  it("невідомий статус відповіді не вважається перевіркою", () => {
    const r = report({ [ALL[0].id]: { s: "maybe" } });
    expect(r.answered).toBe(0);
    expect(r.unanswered.map(x => x.it.id)).toContain(ALL[0].id);
  });
});

describe("службові дані звіту", () => {
  it("кожен неперевірений критичний пункт знає індекс свого етапу", () => {
    const i = mkInsp(CFG, {});
    const stages = visibleStages(i);
    computeReport(i).critUnchecked.forEach(x => {
      expect(stages[x.si].items.map(it => it.id)).toContain(x.it.id);
    });
  });

  it("stageProgress: «пропустити» рахується як відповідь для панелі етапу", () => {
    const i = mkInsp(CFG, {});
    const stages = visibleStages(i);
    const [a, b] = stages[0].items;
    i.answers[a.id] = { s: "skip" };
    i.answers[b.id] = { s: "ok" };
    const p = stageProgress(i, stages);
    expect(p[0]).toEqual({ answered: 2, total: stages[0].items.length });
    expect(p[1].answered).toBe(0);
  });
});
