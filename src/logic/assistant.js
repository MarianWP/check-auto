/* Чиста логіка помічника: контекст поточного огляду для моделі й підказки запитань.
   Контекст — звичайний текст, який Edge Function додає до системного промпту. */

export const MAX_CONTEXT = 6000;
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

/* i — огляд, G — API моделі (apiOf), rep — computeReport, stages — visibleStages, verdict — текст вердикту. */
export function buildContext({ i, G, rep, stages, verdict, stageNow }) {
  if (!i || !G) return "";
  const e = G.engine(i.cfg.engine), g = G.gearbox(i.cfg.gear), b = G.body(i.cfg.body), price = G.priceFor(i.cfg);
  const L = [];
  L.push("Авто: " + G.model.full + ", " + G.label(i.cfg) + (i.name ? " (" + i.name + ")" : ""));
  if (i.price) L.push("Ціна продавця: $" + i.price);
  if (price) L.push("Ринковий діапазон для такої конфігурації: $" + Math.round(price.lo) + "–" + Math.round(price.hi));
  if (e) {
    L.push("Двигун " + e.name + " (" + e.codes + "), надійність " + e.reliability + " з 5: " + clip(e.summary, 300));
    if (e.timing && e.timing.text) L.push("ГРМ: " + clip(e.timing.text, 160));
    if (e.issues && e.issues.length) L.push("Типові проблеми двигуна: " + e.issues.map(x => x.t).join("; "));
  }
  if (g) L.push("Коробка " + g.name + (g.issues && g.issues.length ? ". Типові проблеми: " + g.issues.map(x => x.t).join("; ") : ""));
  if (b) L.push("Кузов: " + b.name);
  if (G.COMMON && G.COMMON.length) L.push("Хвороби моделі: " + G.COMMON.map(x => x.t).join("; "));
  if (rep) {
    L.push("", "Стан огляду: перевірено " + rep.pct + " % (" + rep.answered + " з " + rep.total + "), критичних перевірено " + rep.critChecked + " з " + rep.critTotal + ". Поточний вердикт: " + (verdict || rep.verdict) + ".");
    const fails = ["crit", "major", "minor"].flatMap(k => rep.fails[k].map(f => ({ k, f })));
    if (fails.length) {
      L.push("Знайдені проблеми:");
      fails.forEach(({ k, f }) => L.push("- [" + ({ crit: "критично", major: "важливо", minor: "дрібниця" })[k] + "] " + f.it.t + (f.a.tags && f.a.tags.length ? " (" + f.a.tags.join(", ") + ")" : "") + (f.a.c ? ". Коментар користувача: " + clip(f.a.c, 200) : "")));
    } else L.push("Проблем поки не знайдено.");
    if (rep.critUnchecked.length) L.push("Критичні пункти ще без перевірки: " + rep.critUnchecked.slice(0, 12).map(x => x.it.t).join("; "));
    if (rep.cost && rep.cost.hi) L.push("Орієнтовний бюджет на усунення знайденого: $" + rep.cost.lo + "–" + rep.cost.hi);
  }
  if (stageNow && stages) {
    const s = stages.find(x => x.id === stageNow);
    if (s) L.push("", "Користувач зараз на етапі «" + s.name + "». Пункти етапу: " + s.items.map(x => x.t).join("; "));
  }
  return clip(L.join("\n").replace(/ +\n/g, "\n"), MAX_CONTEXT).replace(/\n /g, "\n");
}

/* Підказки для порожнього чату: з оглядом — про це авто, без огляду — загальні. */
export function suggestions(i, G) {
  if (i && G) {
    const e = G.engine(i.cfg.engine), g = G.gearbox(i.cfg.gear);
    const out = ["На що звернути увагу саме в цій конфігурації?", "Які знайдені проблеми найдорожчі в усуненні?", "Скільки просити знижки за знайдене?"];
    if (e) out.push("Як перевірити ГРМ на " + e.name + " без сервісу?");
    if (g && g.tags && g.tags.includes("dsg")) out.push("Як на тест-драйві зрозуміти, що DSG проблемна?");
    return out;
  }
  return ["З чого почати огляд вживаного авто?", "Як відрізнити перефарбований кузов від заводського?", "Що перевірити в документах перед купівлею?", "Які питання поставити продавцю по телефону?"];
}

/* Чергування ролей для показу і підрахунку: рядки бази → повідомлення чату. */
export const messageFromRow = r => (r && (r.role === "user" || r.role === "assistant") && typeof r.content === "string" ? { id: r.id, role: r.role, content: r.content, at: r.created_at ? Date.parse(r.created_at) : 0 } : null);
