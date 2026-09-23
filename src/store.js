/* Golf Check — стан застосунку (Vue reactive): огляди, чернетка, інтерфейс, збереження.
   Чиста логіка (звіт, перевірка записів) живе у src/logic/ і покрита тестами. */
import { reactive, watch } from "vue";
import CL from "./data/checklist.js";
import { apiOf, modelApi, modelDef, registerModel, unregisterModel, MODELS, DEFAULT_MODEL } from "./data/index.js";
import { aiItemsOf } from "./logic/generated";
import { computeReport as computeReportPure, visibleStages as visibleStagesPure, stageProgress } from "./logic/report";
import { KEY, MODELS_KEY, parseState, parseModels, validConfig, normalizeList } from "./logic/storage";
import { readAccount, writeAccount, accountKey } from "./logic/persistence";

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

export const account = reactive({ scope: "guest", epoch: 0, guestCount: 0 });
const emptyDraft = () => ({ model: DEFAULT_MODEL, fuel: null, engine: null, body: null, year: null, gear: null, name: "", price: "" });
export const draft = reactive(emptyDraft());
export const aiModels = () => MODELS.filter(m => m.ai);
const listeners = new Set();
export const onDataChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
let saveT = null, loading = false;
const memory = new Map();
function changed(event = { type: "update" }) {
  if (loading) return;
  clearTimeout(saveT); saveT = setTimeout(writeNow, 300);
  listeners.forEach(fn => fn(event));
}
function read(scope) {
  if (memory.has(scope)) return memory.get(scope);
  let saved = null;
  try {
    saved = readAccount(localStorage, scope);
    if (!saved && scope === "guest") {
      const raw = localStorage.getItem(KEY);
      saved = raw ? JSON.parse(raw) : { inspections: [] };
      saved.models = JSON.parse(localStorage.getItem(MODELS_KEY) || "[]");
    }
  } catch {
    storage.loadError = "parse";
    try { const raw = localStorage.getItem(accountKey(scope)) || localStorage.getItem(KEY); if (raw) localStorage.setItem(accountKey(scope) + ".corrupt", raw); } catch { /* unavailable */ }
  }
  return saved || { inspections: [], models: [] };
}
function restoreDraft(raw) {
  Object.assign(draft, emptyDraft());
  if (!raw || !modelDef(raw.model)) return;
  draft.model = raw.model;
  draft.name = String(raw.name || "").slice(0, 60);
  draft.price = String(raw.price || "").replace(/\D/g, "").slice(0, 9);
  const G = modelApi(draft.model);
  if (G.ENGINES.some(e => e.fuel === raw.fuel)) draft.fuel = raw.fuel;
  const e = G.engine(raw.engine);
  if (!e || e.fuel !== draft.fuel) return;
  draft.engine = e.id;
  if (!e.bodies.includes(raw.body)) return;
  draft.body = raw.body;
  if (!G.yearsFor(e.id, raw.body).includes(raw.year)) return;
  draft.year = raw.year;
  if (G.gearsFor(e.id, raw.year).some(g => g.id === raw.gear)) draft.gear = raw.gear;
}
function load(scope) {
  const saved = read(scope);
  aiModels().forEach(m => unregisterModel(m.id));
  parseModels(saved.models);
  restoreDraft(saved.draft);
  const res = parseState(JSON.stringify(saved));
  storage.rejected = res.rejected; storage.loadError ||= res.error || "";
  if (res.rejected) {
    try { localStorage.setItem(accountKey(scope) + ".rejected", JSON.stringify(saved)); } catch { /* source remains */ }
  }
  return { pendingInspections: [], ...res.state };
}
export const db = reactive(load("guest"));
function writeNow() {
  clearTimeout(saveT); saveT = null;
  const was = storage.ok;
  try {
    writeAccount(localStorage, account.scope, { ...db, models: aiModels(), draft: { ...draft } });
    memory.delete(account.scope);
    storage.ok = true;
    if (!was) toast("Збереження відновлено");
    return true;
  } catch (e) {
    storage.ok = false;
    memory.set(account.scope, JSON.parse(JSON.stringify({ ...db, models: aiModels(), draft })));
    if (was) toast("Не вдалося зберегти зміни. Зроби резервну копію.", 4000);
    return false;
  }
}
export const flush = () => saveT || !storage.ok ? writeNow() : true;
export function saveModels() { return writeNow(); }
export function addModel(def) { registerModel(def); saveModels(); return def; }
export function restorePending() {
  const recovered = normalizeList(db.pendingInspections).inspections;
  if (!recovered.length) return;
  const ids = new Set(recovered.map(i => i.id));
  db.pendingInspections = db.pendingInspections.filter(i => !ids.has(i.id));
  replaceInspections(db.inspections.concat(recovered.filter(i => !insp(i.id))), true);
}
export function addPending(records) {
  const ids = new Set(db.pendingInspections.map(i => i.id));
  db.pendingInspections.push(...records.filter(i => !ids.has(i.id)));
  changed({ type: "pending" });
}
export function switchAccount(userId) {
  const scope = userId || "guest";
  if (account.scope === scope) return;
  writeNow();
  loading = true;
  try {
    storage.loadError = ""; storage.rejected = 0;
    account.scope = scope;
    Object.assign(db, load(scope));
    account.guestCount = (read("guest").inspections || []).length;
    account.epoch++;
    ui.sheet = null; ui.lightbox = null;
  } finally { loading = false; }
  listeners.forEach(fn => fn({ type: "account" }));
}
export function importGuest() {
  if (account.scope === "guest") return;
  const guest = read("guest");
  parseModels(guest.models);
  const copies = normalizeList(guest.inspections).inspections.map(i => ({ ...i, id: uid(), updatedAt: Date.now(), name: i.name || "Імпортований огляд" }));
  replaceInspections(db.inspections.concat(copies));
  flush();
  toast("Скопійовано гостьових оглядів: " + copies.length);
}
/* Перевірка запису на старті: приватний режим і заборонене сховище видно одразу, а не після огляду. */
export function probeStorage() {
  try { localStorage.setItem(KEY + ".probe", "1"); localStorage.removeItem(KEY + ".probe"); }
  catch (e) { storage.ok = false; }
  return storage.ok;
}
export const reload = () => { /* BFCache already keeps live state; preserve pending edits. */ };
export const dismissLoadNotice = () => { storage.rejected = 0; storage.loadError = ""; };
export const insp = id => db.inspections.find(i => i.id === id);
export function replaceInspections(list, remote = false) {
  const old = new Map(db.inspections.map(i => [i.id, i]));
  db.inspections = list.map(next => {
    const prev = old.get(next.id);
    if (!prev || prev === next) return next;
    const version = (prev._persist || 0) + 1;
    Object.assign(prev, next, { _persist: version });
    return prev;
  });
  changed({ type: remote ? "remote" : "replace" });
}

/* ---------- Чернетка нового огляду ---------- */
export const resetDraft = patch => { Object.assign(draft, emptyDraft(), patch || {}); };
watch(draft, () => changed({ type: "draft" }), { flush: "sync" });
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
  if (!validConfig({ engine: draft.engine, body: draft.body, year: draft.year, gear: draft.gear }, draft.model)) return null;
  const i = {
    id: uid(), model: draft.model, createdAt: Date.now(), updatedAt: Date.now(),
    name: String(draft.name || "").trim().slice(0, 60),
    price: parseInt(String(draft.price || "").replace(/\D/g, ""), 10) || 0,
    cfg: { engine: draft.engine, body: draft.body, year: draft.year, gear: draft.gear },
    answers: {}, stage: 0, done: false
  };
  i.checklistSnapshot = JSON.parse(JSON.stringify(visibleStages(i)));
  i.priceSnapshot = apiOf(i).priceFor(i.cfg);
  i.reportVersion = 1;
  db.inspections.push(i);
  changed({ type: "create", id: i.id });
  resetDraft();
  return insp(i.id);
}

/* ---------- Мутації огляду (i — reactive-об'єкт зі сховища) ---------- */
const ans = (i, id) => { if (!i.answers[id]) i.answers[id] = {}; return i.answers[id]; };
const touch = i => { i.updatedAt = Math.max(Date.now(), i.updatedAt + 1); changed({ type: "update", id: i.id }); };
export const setStage = (i, n) => { if (i.stage !== n) { i.stage = n; touch(i); } };
export const answer = (i, itemId, s) => { const a = ans(i, itemId); a.s = a.s === s ? "" : s; touch(i); };
export const toggleTag = (i, itemId, t) => {
  const a = ans(i, itemId);
  if (!a.tags) a.tags = [];
  const k = a.tags.indexOf(t);
  if (k >= 0) a.tags.splice(k, 1); else a.tags.push(t);
  touch(i);
};
export const setComment = (i, itemId, c) => { ans(i, itemId).c = String(c || "").slice(0, 500); touch(i); };
export const finish = i => {
  if (!i.checklistSnapshot) i.checklistSnapshot = JSON.parse(JSON.stringify(visibleStages(i)));
  if (!i.priceSnapshot) i.priceSnapshot = apiOf(i).priceFor(i.cfg);
  i.reportVersion = 1; i.done = true; touch(i);
};
export const rename = (i, name) => { i.name = String(name || "").trim().slice(0, 60); touch(i); };
export const remove = id => { db.inspections = db.inspections.filter(x => x.id !== id); changed({ type: "delete", id }); };
export const hideInstall = () => { db.hideInstall = true; changed({ type: "prefs" }); };

/* ---------- Текст звіту ---------- */
export function reportText(i) {
  const G = apiOf(i);
  const rep = computeReport(i), price = i.priceSnapshot || G.priceFor(i.cfg), V = VERDICTS[rep.verdict];
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
