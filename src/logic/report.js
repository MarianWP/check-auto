/* Чиста логіка звіту: чек-лист під конфігурацію (вбудований + власні пункти з адмінки), прогрес, оцінка і вердикт.
   Без Vue і без DOM — покрито тестами у tests/report.test.js. */
import { apiOf, modelIdOf } from "../data/index.js";
import CL from "../data/checklist.js";

export const W = { crit: 3, major: 2, minor: 1 };
/* Менше цієї частки перевірених пунктів — «Недостатньо даних». */
export const MIN_DATA = 0.4;
/* Позитивний вердикт («Можна брати», «З торгом») можливий лише від цієї повноти
   і лише коли перевірено всі критичні пункти. */
export const FULL_COVERAGE = 0.8;

/* Вбудований чек-лист + власні пункти (з адмінки) для моделі огляду. Власний пункт має stage (id етапу),
   model (null = для всіх моделей) і ті самі поля, що вбудований; sort задає порядок серед власних. */
export function checklistFor(i, checklist = CL, extra = []) {
  const model = modelIdOf(i);
  const mine = (extra || []).filter(it => it && it.enabled !== false && (!it.model || it.model === model));
  if (!mine.length) return checklist;
  return checklist.map(s => {
    const add = mine.filter(it => it.stage === s.id).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    return add.length ? Object.assign({}, s, { items: s.items.concat(add) }) : s;
  });
}

/* Етапи з пунктами, які стосуються конфігурації авто (поле only = усі теги мають збігтися). */
export function visibleStages(i, checklist = CL, extra = []) {
  const tags = apiOf(i).tagsFor(i.cfg);
  return checklistFor(i, checklist, extra).map(s => Object.assign({}, s, { items: s.items.filter(it => !it.only || it.only.every(t => tags.has(t))) }));
}

/* Прогрес по етапах для панелі чек-листа: «не перевірено» теж вважається відповіддю. */
export function stageProgress(i, stages) {
  return stages.map(s => {
    let answered = 0;
    s.items.forEach(it => { const a = i.answers[it.id]; if (a && a.s) answered++; });
    return { answered, total: s.items.length };
  });
}

/* Вердикт:
   1. Критичний дефект одразу дає «Не рекомендуємо», скільки б пунктів не було перевірено.
   2. Замало даних (< MIN_DATA) — «Недостатньо даних».
   3. Низька оцінка перевіреного (< 65) — «Не рекомендуємо»: знайдені проблеми реальні й при неповному огляді.
   4. Позитивний висновок потребує повноти: >= FULL_COVERAGE і всі критичні пункти перевірені, інакше «Огляд неповний».
   «Перевірено» означає відповідь «ок» або «проблема»; «не перевірено» повноти не додає. */
export function computeReport(i, checklist = CL, extra = []) {
  const stages = visibleStages(i, checklist, extra);
  let total = 0, okW = 0, ansW = 0, ok = 0, lo = 0, hi = 0, critTotal = 0;
  const fails = { crit: [], major: [], minor: [] }, skipped = [], unanswered = [], critUnchecked = [];
  stages.forEach((stage, si) => stage.items.forEach(it => {
    total++;
    if (it.sev === "crit") critTotal++;
    const a = i.answers[it.id], s = a && a.s;
    if (s !== "ok" && s !== "bad") {
      const entry = { it, stage, si };
      (s === "skip" ? skipped : unanswered).push(entry);
      if (it.sev === "crit") critUnchecked.push(entry);
      return;
    }
    ansW += W[it.sev];
    if (s === "ok") { okW += W[it.sev]; ok++; }
    else { fails[it.sev].push({ it, a, stage, si }); if (it.cost) { lo += it.cost[0]; hi += it.cost[1]; } }
  }));
  const failCount = fails.crit.length + fails.major.length + fails.minor.length;
  const answered = ok + failCount;
  const answeredAll = answered + skipped.length;
  const coverage = total ? answered / total : 0;
  const pct = Math.round(coverage * 100);
  const critChecked = critTotal - critUnchecked.length;
  const complete = coverage >= FULL_COVERAGE && critUnchecked.length === 0;
  const score = ansW ? Math.max(0, Math.min(100, Math.round(okW / ansW * 100) - 25 * fails.crit.length)) : 0;
  let verdict;
  if (fails.crit.length) verdict = "no";
  else if (coverage < MIN_DATA) verdict = "nodata";
  else if (score < 65) verdict = "no";
  else if (!complete) verdict = "partial";
  else if (score >= 85 && fails.major.length <= 1) verdict = "good";
  else verdict = "bargain";
  return {
    stages, total, ok, failCount, fails, skipped, unanswered, answered, answeredAll,
    coverage, pct, critTotal, critChecked, critUnchecked, complete, score, verdict, cost: { lo, hi }
  };
}
