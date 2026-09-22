/* Чиста логіка карток, які склав ШІ для «іншого авто»: перевірка відповіді моделі й перетворення
   на визначення моделі для реєстру (src/data/index.js) з власними бібліотеками двигуна й коробки.
   Будь-яке сміття у відповіді дає null або безпечні типові значення, а не виняток. */
import CL from "../data/checklist.js";

export const TAGS = ["petrol", "diesel", "hybrid", "electric", "belt", "chain", "turbo", "dsg", "at", "manual", "cvt", "dpf", "pd", "lpg"];
export const FUELS = [{ id: "petrol", name: "Бензин" }, { id: "diesel", name: "Дизель" }, { id: "hybrid", name: "Гібрид" }, { id: "electric", name: "Електро" }];
export const GEARS = [
  { id: "manual", name: "Механіка", tags: ["manual"] },
  { id: "at", name: "Автомат", tags: ["at"] },
  { id: "dsg", name: "Робот / DSG", tags: ["dsg"] },
  { id: "cvt", name: "Варіатор", tags: ["cvt"] },
  { id: "unknown", name: "Не знаю", tags: [] }
];
export const BODIES = ["Хетчбек", "Седан", "Універсал", "Кросовер / SUV", "Мінівен", "Купе / кабріолет", "Пікап / фургон"];
export const YEAR_MIN = 1990, YEAR_MAX = new Date().getFullYear() + 1;
export const GEN_STEPS = [
  "Шукаю дані про це авто…",
  "Збираю типові хвороби двигуна й коробки…",
  "Оцінюю ринкові ціни…",
  "Формую чек-лист саме під це авто…",
  "Готую картку авто…"
];
const STAGE_IDS = new Set(CL.map(s => s.id));
const SEVS = new Set(["crit", "major", "minor"]);
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const cost = v => { if (!Array.isArray(v) || v.length < 2) return null; const a = num(v[0], 0, 100000, null), b = num(v[1], 0, 100000, null); if (a === null || b === null) return null; return [Math.min(a, b), Math.max(a, b)]; };
const issues = (v, max) => (Array.isArray(v) ? v : []).map(x => isObj(x) ? { t: str(x.t, 120), d: str(x.d, 400), sev: SEVS.has(x.sev) ? x.sev : "major", cost: cost(x.cost) || [0, 0] } : null).filter(x => x && x.t && x.d).slice(0, max);
const strList = (v, max, len) => (Array.isArray(v) ? v : []).map(x => str(x, len)).filter(Boolean).slice(0, max);

/* Що користувач вписав у форму. Повертає текст помилки або "". */
export function inputError(f) {
  if (!str(f.brand, 40)) return "Вкажи марку авто";
  if (!str(f.model, 60)) return "Вкажи модель";
  const y = Number(f.year);
  if (!Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) return "Вкажи рік випуску від " + YEAR_MIN + " до " + YEAR_MAX;
  return "";
}

/* Відповідь ШІ + що вводив користувач → модель для реєстру. null, якщо бракує головного. */
export function normalizeGenerated(raw, meta) {
  if (!isObj(raw) || !isObj(meta) || typeof meta.id !== "string" || !meta.id) return null;
  const src = isObj(meta.source) ? meta.source : {};
  const year = num(src.year, YEAR_MIN, YEAR_MAX, null);
  const brand = str(raw.brand, 40) || str(src.brand, 40);
  const name = str(raw.name, 60) || str(src.model, 60);
  const e = isObj(raw.engine) ? raw.engine : null;
  if (!brand || !name || year === null || !e || !str(e.name, 60)) return null;

  const years = Array.isArray(raw.years) ? [num(raw.years[0], YEAR_MIN, YEAR_MAX, year), num(raw.years[1], YEAR_MIN, YEAR_MAX, year)] : [year, year];
  const y0 = Math.min(years[0], years[1], year), y1 = Math.max(years[0], years[1], year);
  const fuel = FUELS.some(f => f.id === e.fuel) ? e.fuel : "petrol";
  const tags = Array.from(new Set([fuel].concat((Array.isArray(e.tags) ? e.tags : []).filter(t => TAGS.includes(t)))));
  const gRaw = isObj(raw.gearbox) ? raw.gearbox : {};
  const gPick = GEARS.find(g => g.id === src.gear) || GEARS[4];
  const gTags = Array.from(new Set(gPick.tags.concat((Array.isArray(gRaw.tags) ? gRaw.tags : []).filter(t => ["manual", "at", "dsg", "cvt"].includes(t)))));
  const bRaw = isObj(raw.body) ? raw.body : {};
  const bodyName = str(bRaw.name, 40) || str(src.body, 40) || "Кузов не вказано";
  const price = cost(raw.price) || [1000, 3000];
  const market = isObj(raw.market) ? raw.market : {};
  const timing = isObj(e.timing) ? e.timing : {};
  const vinRaw = isObj(raw.vin) ? raw.vin : {};

  const id = meta.id;
  const def = {
    id, ai: true, draft: false, brand, name,
    short: name, full: str(raw.full, 80) || (brand + " " + name),
    years: [y0, y1], priceBaseYear: year,
    market: { avg: num(market.avg, 100, 500000, Math.round((price[0] + price[1]) / 2)), updated: "оцінка ШІ", search: /^https:\/\/auto\.ria\.com\//.test(str(market.search, 200)) ? str(market.search, 200) : "https://auto.ria.com/uk/search/?indexName=auto&brand.name=" + encodeURIComponent(brand) + "&model.name=" + encodeURIComponent(name) },
    bodies: [{ id: "b1", name: bodyName, short: str(bRaw.short, 20) || bodyName.split(/[ ,/]/)[0], years: [y0, y1], factor: 1, note: str(bRaw.note, 200) }],
    engines: [{ id: "e1", years: [y0, y1], bodies: ["b1"], gears: ["g1"], price: [price[0] === price[1] ? Math.max(0, price[0] - 500) : price[0], price[1]] }],
    engineLib: {
      e1: {
        id: "e1", fuel, name: str(e.name, 60), hp: str(e.hp, 30) || "—", codes: str(e.codes, 80) || "—", tags,
        timing: { type: ["belt", "chain", "gear", "none"].includes(timing.type) ? timing.type : (tags.includes("chain") ? "chain" : "belt"), text: str(timing.text, 200) || "Уточни регламент ГРМ у продавця або на СТО." },
        reliability: Math.round(num(e.reliability, 1, 5, 3)), lpg: ["ok", "hard", "no"].includes(e.lpg) ? e.lpg : (fuel === "petrol" ? "hard" : "no"),
        summary: str(e.summary, 600) || "Дані про двигун склав ШІ на основі загальних відомостей.", verdict: str(e.verdict, 300) || "Перевір типові проблеми зі списку нижче.",
        issues: issues(e.issues, 10)
      }
    },
    gearboxLib: [{
      id: "g1", name: str(gRaw.name, 60) || gPick.name, short: str(gRaw.short, 20) || str(gRaw.name, 20) || gPick.name, tags: gTags, factor: 1,
      reliability: Math.round(num(gRaw.reliability, 1, 5, 3)), summary: str(gRaw.summary, 500) || "", issues: issues(gRaw.issues, 8)
    }],
    common: issues(raw.common, 14).map(x => ({ t: x.t, d: x.d, cost: x.cost, area: "" })),
    vin: { rows: (Array.isArray(vinRaw.rows) ? vinRaw.rows : []).map(r => Array.isArray(r) && r.length >= 2 ? [str(r[0], 20), str(r[1], 160)] : null).filter(r => r && r[0] && r[1]).slice(0, 12), places: strList(vinRaw.places, 6, 160) },
    plants: (Array.isArray(raw.plants) ? raw.plants : []).map(p => isObj(p) ? { code: str(p.code, 6), name: str(p.name, 80), note: str(p.note, 160) } : null).filter(p => p && p.name).slice(0, 8),
    trims: (Array.isArray(raw.trims) ? raw.trims : []).map(t => isObj(t) ? { name: str(t.name, 40), note: str(t.note, 200) } : null).filter(t => t && t.name).slice(0, 8),
    kit: strList(raw.kit, 12, 120),
    items: (Array.isArray(raw.items) ? raw.items : []).map((x, k) => {
      if (!isObj(x) || !STAGE_IDS.has(x.stage)) return null;
      const t = str(x.t, 160), how = str(x.how, 500);
      if (!t || !how) return null;
      const it = { id: id + "_" + k, stage: x.stage, t, how, why: str(x.why, 400), sev: SEVS.has(x.sev) ? x.sev : "major" };
      const c = cost(x.cost); if (c && c[1]) it.cost = c;
      return it;
    }).filter(Boolean).slice(0, 16),
    source: { brand: str(src.brand, 40), model: str(src.model, 60), year, fuel: str(src.fuel, 12), engine: str(src.engine, 60), gear: str(src.gear, 12), body: str(src.body, 40) },
    createdAt: num(meta.createdAt, 0, 4102444800000, Date.now())
  };
  return def;
}

/* Пункти чек-листа, які ШІ склав для цієї моделі, у форматі власних пунктів (як з адмінки). */
export function aiItemsOf(def) {
  if (!def || !def.ai || !Array.isArray(def.items)) return [];
  return def.items.map((x, k) => Object.assign({ custom: true, ai: true, model: def.id, sort: k, enabled: true }, x));
}
