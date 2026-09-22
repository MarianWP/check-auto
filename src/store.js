/* Golf Check — стан застосунку (Vue reactive): огляди, чернетка, інтерфейс, збереження.
   Чиста логіка (звіт, перевірка записів) живе у src/logic/ і покрита тестами. */
import { reactive, watch } from "vue";
import CL from "./data/checklist.js";
import { apiOf, modelApi, modelDef, registerModel, MODELS, DEFAULT_MODEL } from "./data/index.js";
import { aiItemsOf } from "./logic/generated";
import { computeReport as computeReportPure, visibleStages as visibleStagesPure, stageProgress } from "./logic/report";
import { KEY, MODELS_KEY, parseState, parseModels } from "./logic/storage";

export { stageProgress, MIN_DATA, FULL_COVERAGE } from "./logic/report";
export { apiOf, modelApi, modelDef, MODELS, DEFAULT_MODEL } from "./data/index.js";

/* Власні пункти чек-листа з адмінки (заповнює src/cloud/content.js). Тут — щоб звіт їх бачив без циклічного імпорту. */
export const extraItems = reactive({ list: [] });
/* Власні пункти з адмінки + пункти, які ШІ склав для моделі цього огляду. */
const extraFor = i => { const m = modelDef(i && i.model); return m && m.ai ? extraItems.list.concat(aiItemsOf(m)) : extraItems.list; };
export const visibleStages = i => visibleStagesPure(i, CL, extraFor(i));
export const computeReport = i => computeReportPure(i, CL, extraFor(i));

export const SEV_LABEL = { crit: "Критично", major: "Важливо", minor: "Дрібниця" };
const found = r => r.failCount ? " Уже знайдено проблем: " + r.failCount + "." : "";
export const VERDICTS = {
  good: { t: "Можна брати", short: "Можна брати", icon: "circleCheck", s: () => "Огляд повний, серйозних проблем не знайдено. Дрібниці — привід для невеликого торгу." },
  bargain: { t: "Брати з торгом", short: "З торгом", icon: "circleAlert", s: () => "Огляд повний, є важливі зауваження. Відніми від ціни бюджет на їх усунення." },
  no: { t: "Не рекомендуємо", short: "Не брати", icon: "circleX", s: r => r.fails.crit.length ? "Знайдено критичних проблем: " + r.fails.crit.length + ". Краще пошукати інший екземпляр." : "Забагато проблем для цієї ціни. Краще пошукати інший екземпляр." },
  partial: { t: "Огляд неповний", short: "Неповний", icon: "circleDashed", s: r => "Перевірено " + r.pct + " % пунктів" + (r.critUnchecked.length ? ", критичних без перевірки: " + r.critUnchecked.length : "") + "." + (r.failCount ? found(r) : " Серйозних проблем поки немає.") + " Доверши огляд, щоб отримати вердикт." },
  nodata: { t: "Недостатньо даних", short: "Мало даних", icon: "circleDashed", s: r => "Перевірено " + r.pct + " % пунктів." + found(r) + " Пройди решту етапів, щоб отримати вердикт." }
};

/* ---------- Утиліти ---------- */
export const fmtN = n => Math.round(n).toLocaleString("uk-UA");
export const money = n => "$" + fmtN(n);
export const costStr = c => c[0] === c[1] ? money(c[0]) : money(c[0]) + "–" + fmtN(c[1]);
export const dateStr = ts => new Date(ts).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Стан інтерфейсу: аркуш дій, тост, перегляд фото, ціль прокрутки ---------- */
export const ui = reactive({ sheet: null, toast: null, lightbox: null, scrollTarget: null });
let toastT = null;
export function toast(msg, ms) {
  ui.toast = { id: Date.now(), msg };
  clearTimeout(toastT);
  toastT = setTimeout(() => { ui.toast = null; }, ms || 2200);
}
export const sheet = o => { ui.sheet = o; };
export const closeSheet = () => { ui.sheet = null; };
export const openLightbox = (url, caption) => { ui.lightbox = { url, caption: caption || "" }; };
export const closeLightbox = () => { ui.lightbox = null; };

/* ---------- Сховище: localStorage, формат golfcheck.v1 ----------
   storage.ok       — чи вдається зберігати; false = зміни живуть лише до закриття апки.
   storage.rejected — скільки записів не пройшли перевірку під час завантаження.
   storage.loadError — збережені дані не читаються (parse/shape). Оригінал у такому разі
                       відкладається в KEY + ".corrupt", щоб наступне збереження його не затерло. */
export const storage = reactive({ ok: true, rejected: 0, loadError: "" });

function readRaw() { try { return localStorage.getItem(KEY); } catch (e) { storage.ok = false; return null; } }
function load() {
  const raw = readRaw();
  const res = parseState(raw);
  storage.rejected = res.rejected;
  storage.loadError = res.error || "";
  if (raw && (res.error || res.rejected)) { try { localStorage.setItem(KEY + ".corrupt", raw); } catch (e) { /* немає місця або доступу */ } }
  return res.state;
}
/* Моделі ШІ читаються ДО оглядів: інакше огляд на такій моделі не пройде перевірку конфігурації. */
function loadModels() { try { return parseModels(localStorage.getItem(MODELS_KEY)); } catch (e) { return { models: [], rejected: 0 }; } }
loadModels();
export const aiModels = () => MODELS.filter(m => m.ai);
export function saveModels() { try { localStorage.setItem(MODELS_KEY, JSON.stringify(aiModels())); } catch (e) { /* немає місця або доступу */ } }
/* Додає модель від ШІ (уже нормалізовану) у реєстр і сховище. */
export function addModel(def) { registerModel(def); saveModels(); return def; }
export const db = reactive(load());

let saveT = null;
function writeNow() {
  clearTimeout(saveT); saveT = null;
  const was = storage.ok;
  try {
    localStorage.setItem(KEY, JSON.stringify({ inspections: db.inspections, hideInstall: db.hideInstall }));
    storage.ok = true;
    if (!was) toast("Збереження відновлено");
  } catch (e) {
    storage.ok = false;
    if (was) toast("Не вдалося зберегти зміни. Зроби резервну копію.", 4000);
  }
}
watch(db, () => { clearTimeout(saveT); saveT = setTimeout(writeNow, 50); }, { deep: true });
/* Апку можуть закрити одразу після відповіді — не чекаємо таймера. */
export const flush = () => { if (saveT) writeNow(); };
/* Перевірка запису на старті: приватний режим і заборонене сховище видно одразу, а не після огляду. */
export function probeStorage() {
  try { localStorage.setItem(KEY + ".probe", "1"); localStorage.removeItem(KEY + ".probe"); }
  catch (e) { storage.ok = false; }
  return storage.ok;
}
export const reload = () => { Object.assign(db, load()); };
export const dismissLoadNotice = () => { storage.rejected = 0; storage.loadError = ""; };
export const insp = id => db.inspections.find(i => i.id === id);
export const replaceInspections = list => { db.inspections = list; };

/* ---------- Чернетка нового огляду ---------- */
const emptyDraft = () => ({ model: DEFAULT_MODEL, fuel: null, engine: null, body: null, year: null, gear: null, name: "", price: "" });
export const draft = reactive(emptyDraft());
export const resetDraft = patch => { Object.assign(draft, emptyDraft(), patch || {}); };
/* Повертає id секції, до якої варто прокрутити після вибору. */
export function setDraft(k, v) {
  const G = modelApi(draft.model);
  if (k === "model") {
    if (draft.model !== v && modelDef(v)) Object.assign(draft, emptyDraft(), { model: v, name: draft.name, price: draft.price });
  } else if (k === "fuel") {
    if (draft.fuel !== v) Object.assign(draft, emptyDraft(), { model: draft.model, fuel: v, name: draft.name, price: draft.price });
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
  return !draft.fuel ? "s-fuel" : !draft.engine ? "s-engine" : !draft.body ? "s-body" : !draft.year ? "s-year" : !draft.gear ? "s-gear" : "s-final";
}
export function createInspection() {
  if (!draft.gear) return null;
  const i = {
    id: uid(), model: draft.model, createdAt: Date.now(), updatedAt: Date.now(),
    name: String(draft.name || "").trim().slice(0, 60),
    price: parseInt(String(draft.price || "").replace(/\D/g, ""), 10) || 0,
    cfg: { engine: draft.engine, body: draft.body, year: draft.year, gear: draft.gear },
    answers: {}, stage: 0, done: false
  };
  db.inspections.push(i);
  resetDraft();
  return insp(i.id);
}

/* ---------- Мутації огляду (i — reactive-об'єкт зі сховища) ---------- */
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
  const G = apiOf(i);
  const rep = computeReport(i), price = G.priceFor(i.cfg), V = VERDICTS[rep.verdict];
  const L = ["Golf Check — звіт огляду", G.model.full + " · " + G.label(i.cfg) + (i.name ? " · " + i.name : ""), dateStr(i.updatedAt), ""];
  L.push("Вердикт: " + V.t + " (оцінка перевіреного " + rep.score + " зі 100)");
  L.push("Повнота огляду: " + rep.pct + " % (" + rep.answered + " з " + rep.total + " пунктів, критичних " + rep.critChecked + " з " + rep.critTotal + "), проблем: " + rep.failCount);
  if (i.price) L.push("Ціна продавця: " + money(i.price));
  L.push("Ринок: " + money(price.lo) + "–" + fmtN(price.hi));
  if (rep.cost.hi) L.push("Бюджет на усунення: ≈ " + costStr([rep.cost.lo, rep.cost.hi]));
  [["crit", "КРИТИЧНО"], ["major", "ВАЖЛИВО"], ["minor", "ДРІБНИЦІ"]].forEach(([k, t]) => {
    if (!rep.fails[k].length) return;
    L.push("", t + ":");
    rep.fails[k].forEach(f => {
      L.push("• " + f.it.t + (f.a.tags && f.a.tags.length ? " — " + f.a.tags.join(", ") : ""));
      if (f.a.c) L.push("  Коментар: " + f.a.c);
    });
  });
  if (rep.critUnchecked.length) {
    L.push("", "КРИТИЧНІ ПУНКТИ БЕЗ ПЕРЕВІРКИ:");
    rep.critUnchecked.forEach(x => L.push("• " + x.it.t));
  }
  const rest = rep.skipped.length + rep.unanswered.length;
  if (rest) L.push("", "Не перевірено: " + rest + " пунктів");
  return L.join("\n");
}
