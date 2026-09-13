/* Golf Check — стан застосунку (Vue reactive) і чисті обчислення. Тут немає DOM. */
import { reactive, watch } from "vue";
import G from "./data/golf";
import CL from "./data/checklist";

const KEY = "golfcheck.v1";
const W = { crit: 3, major: 2, minor: 1 };

export const SEV_LABEL = { crit: "Критично", major: "Важливо", minor: "Дрібниця" };
export const VERDICTS = {
  good: { t: "Можна брати", short: "Можна брати", s: () => "Серйозних проблем не знайдено. Дрібниці — привід для невеликого торгу." },
  bargain: { t: "Брати з торгом", short: "З торгом", s: () => "Є важливі зауваження. Відніми від ціни бюджет на їх усунення." },
  no: { t: "Не рекомендуємо", short: "Не брати", s: r => r.fails.crit.length ? "Знайдено критичних проблем: " + r.fails.crit.length + ". Краще пошукати інший екземпляр." : "Забагато проблем для цієї ціни. Краще пошукати інший екземпляр." },
  nodata: { t: "Недостатньо даних", short: "Мало даних", s: r => "Перевірено " + r.pct + " % пунктів. Пройди решту етапів, щоб отримати вердикт." }
};

/* ---------- Утиліти ---------- */
export const fmtN = n => Math.round(n).toLocaleString("uk-UA");
export const money = n => "$" + fmtN(n);
export const costStr = c => c[0] === c[1] ? money(c[0]) : money(c[0]) + "–" + fmtN(c[1]);
export const dateStr = ts => new Date(ts).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Сховище: localStorage, формат golfcheck.v1 без змін ---------- */
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.inspections)) return { inspections: d.inspections, hideInstall: !!d.hideInstall };
  } catch (e) { /* немає доступу */ }
  return { inspections: [], hideInstall: false };
}
export const db = reactive(load());
let saveT = null;
watch(db, () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ inspections: db.inspections, hideInstall: db.hideInstall })); } catch (e) { /* приватний режим */ }
  }, 50);
}, { deep: true });
export const reload = () => { Object.assign(db, load()); };
export const insp = id => db.inspections.find(i => i.id === id);

/* ---------- Обчислення ---------- */
export function visibleStages(i) {
  const tags = G.tagsFor(i.cfg);
  return CL.map(s => Object.assign({}, s, { items: s.items.filter(it => !it.only || it.only.every(t => tags.has(t))) }));
}
export function computeReport(i) {
  const stages = visibleStages(i);
  let total = 0, okW = 0, ansW = 0, ok = 0, lo = 0, hi = 0;
  const fails = { crit: [], major: [], minor: [] }, skipped = [], unanswered = [];
  stages.forEach(stage => stage.items.forEach(it => {
    total++;
    const a = i.answers[it.id], s = a && a.s;
    if (!s) { unanswered.push({ it, stage }); return; }
    if (s === "skip") { skipped.push({ it, stage }); return; }
    ansW += W[it.sev];
    if (s === "ok") { okW += W[it.sev]; ok++; }
    else { fails[it.sev].push({ it, a, stage }); if (it.cost) { lo += it.cost[0]; hi += it.cost[1]; } }
  }));
  const failCount = fails.crit.length + fails.major.length + fails.minor.length;
  const answered = ok + failCount;
  const answeredAll = answered + skipped.length;
  const pct = total ? Math.round(answered / total * 100) : 0;
  const score = ansW ? clamp(Math.round(okW / ansW * 100) - 25 * fails.crit.length, 0, 100) : 0;
  let verdict;
  if (answered < total * 0.4) verdict = "nodata";
  else if (fails.crit.length) verdict = "no";
  else if (score >= 85 && fails.major.length <= 1) verdict = "good";
  else if (score >= 65) verdict = "bargain";
  else verdict = "no";
  return { stages, total, ok, failCount, fails, skipped, unanswered, answered, answeredAll, pct, score, verdict, cost: { lo, hi } };
}
export function stageProgress(i, stages) {
  return stages.map(s => {
    let answered = 0;
    s.items.forEach(it => { const a = i.answers[it.id]; if (a && a.s) answered++; });
    return { answered, total: s.items.length };
  });
}

/* ---------- Чернетка нової перевірки ---------- */
const emptyDraft = () => ({ fuel: null, engine: null, body: null, year: null, gear: null, name: "", price: "" });
export const draft = reactive(emptyDraft());
export const resetDraft = patch => { Object.assign(draft, emptyDraft(), patch || {}); };
/* Повертає id секції, до якої варто прокрутити після вибору. */
export function setDraft(k, v) {
  if (k === "fuel") {
    if (draft.fuel !== v) Object.assign(draft, emptyDraft(), { fuel: v, name: draft.name, price: draft.price });
  } else if (k === "engine") {
    draft.engine = v;
    const e = G.engine(v);
    if (!e.bodies.includes(draft.body)) draft.body = null;
    if (draft.body && !G.yearsFor(v, draft.body).includes(draft.year)) draft.year = null;
    if (!draft.year || !G.gearsFor(v, draft.year).some(g => g.id === draft.gear)) draft.gear = null;
  } else if (k === "body") {
    draft.body = v;
    if (!G.yearsFor(draft.engine, v).includes(draft.year)) draft.year = null;
    if (!draft.year) draft.gear = null;
  } else if (k === "year") {
    draft.year = parseInt(v, 10);
    if (!G.gearsFor(draft.engine, draft.year).some(g => g.id === draft.gear)) draft.gear = null;
  } else if (k === "gear") draft.gear = v;
  return !draft.engine ? "s-engine" : !draft.body ? "s-body" : !draft.year ? "s-year" : !draft.gear ? "s-gear" : "s-final";
}
export function createInspection() {
  if (!draft.gear) return null;
  const i = {
    id: uid(), createdAt: Date.now(), updatedAt: Date.now(),
    name: String(draft.name || "").trim().slice(0, 60),
    price: parseInt(String(draft.price || "").replace(/\D/g, ""), 10) || 0,
    cfg: { engine: draft.engine, body: draft.body, year: draft.year, gear: draft.gear },
    answers: {}, stage: 0, done: false
  };
  db.inspections.push(i);
  resetDraft();
  return insp(i.id);
}

/* ---------- Мутації перевірки (i — reactive-об'єкт зі сховища) ---------- */
const ans = (i, id) => { if (!i.answers[id]) i.answers[id] = {}; return i.answers[id]; };
const touch = i => { i.updatedAt = Date.now(); };
export const answer = (i, itemId, s) => { const a = ans(i, itemId); a.s = a.s === s ? "" : s; touch(i); };
export const toggleTag = (i, itemId, t) => {
  const a = ans(i, itemId);
  if (!a.tags) a.tags = [];
  const k = a.tags.indexOf(t);
  if (k >= 0) a.tags.splice(k, 1); else a.tags.push(t);
  touch(i);
};
export const setComment = (i, itemId, c) => { ans(i, itemId).c = String(c || "").slice(0, 500); touch(i); };
export const finish = i => { i.done = true; touch(i); };
export const rename = (i, name) => { i.name = String(name || "").trim().slice(0, 60); touch(i); };
export const remove = id => { db.inspections = db.inspections.filter(x => x.id !== id); };
export const hideInstall = () => { db.hideInstall = true; };

/* ---------- Текст звіту ---------- */
export function reportText(i) {
  const rep = computeReport(i), price = G.priceFor(i.cfg), V = VERDICTS[rep.verdict];
  const L = ["Golf Check — звіт огляду", G.label(i.cfg) + (i.name ? " · " + i.name : ""), dateStr(i.updatedAt), ""];
  L.push("Вердикт: " + V.t + " (" + rep.score + " зі 100)");
  L.push("Перевірено " + rep.answered + " з " + rep.total + " пунктів, проблем: " + rep.failCount);
  if (i.price) L.push("Ціна продавця: " + money(i.price));
  L.push("Ринок: " + money(price.lo) + "–" + fmtN(price.hi));
  if (rep.cost.hi) L.push("Бюджет на усунення: ≈ " + costStr([rep.cost.lo, rep.cost.hi]));
  [["crit", "КРИТИЧНО"], ["major", "ВАЖЛИВО"], ["minor", "ДРІБНИЦІ"]].forEach(([k, t]) => {
    if (!rep.fails[k].length) return;
    L.push("", t + ":");
    rep.fails[k].forEach(f => {
      L.push("• " + f.it.t + (f.a.tags && f.a.tags.length ? " — " + f.a.tags.join(", ") : ""));
      if (f.a.c) L.push("  " + f.a.c);
    });
  });
  const rest = rep.skipped.length + rep.unanswered.length;
  if (rest) L.push("", "Не перевірено: " + rest + " пунктів");
  return L.join("\n");
}

/* ---------- Стан інтерфейсу: аркуш дій, тост, ціль прокрутки ---------- */
export const ui = reactive({ sheet: null, toast: null, scrollTarget: null });
let toastT = null;
export function toast(msg) {
  ui.toast = { id: Date.now(), msg };
  clearTimeout(toastT);
  toastT = setTimeout(() => { ui.toast = null; }, 2200);
}
export const sheet = o => { ui.sheet = o; };
export const closeSheet = () => { ui.sheet = null; };
