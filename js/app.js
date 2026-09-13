/* Golf Check — логіка застосунку. Без залежностей, без збірки. */
(function () {
  "use strict";
  const G = window.GOLF, CL = window.CHECKLIST;
  const app = document.getElementById("app");
  const TG = window.TG || { active: false, setBack() {}, onReady() {}, haptic() {}, openLink() { return false; }, share() {} };
  const KEY = "golfcheck.v1";
  const W = { crit: 3, major: 2, minor: 1 };
  const SEV_LABEL = { crit: "Критично", major: "Важливо", minor: "Дрібниця" };
  const VERDICTS = {
    good: { t: "Можна брати", short: "Можна брати", s: () => "Серйозних проблем не знайдено. Дрібниці — привід для невеликого торгу." },
    bargain: { t: "Брати з торгом", short: "З торгом", s: () => "Є важливі зауваження. Відніми від ціни бюджет на їх усунення." },
    no: { t: "Не рекомендуємо", short: "Не брати", s: r => r.fails.crit.length ? "Знайдено критичних проблем: " + r.fails.crit.length + ". Краще пошукати інший екземпляр." : "Забагато проблем для цієї ціни. Краще пошукати інший екземпляр." },
    nodata: { t: "Недостатньо даних", short: "Мало даних", s: r => "Перевірено " + r.pct + " % пунктів. Пройди решту етапів, щоб отримати вердикт." }
  };

  /* ---------- Сховище ---------- */
  let db = load();
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.inspections)) return d; } catch (e) { /* немає доступу */ }
    return { inspections: [], hideInstall: false };
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* приватний режим */ } }, 50);
  }
  const insp = id => db.inspections.find(i => i.id === id);

  /* ---------- Утиліти ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const fmtN = n => Math.round(n).toLocaleString("uk-UA");
  const money = n => "$" + fmtN(n);
  const costStr = c => c[0] === c[1] ? money(c[0]) : money(c[0]) + "–" + fmtN(c[1]);
  const dateStr = ts => new Date(ts).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Іконки — Lucide (js/icons.js, згенеровано з lucide-static). */
  const ICONS = window.LUCIDE || {};
  const icon = (n, cls) => "<svg class=\"i " + (cls || "") + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">" + (ICONS[n] || "") + "</svg>";
  const dotsHtml = r => { let s = ""; for (let k = 1; k <= 5; k++) s += "<i class=\"" + (k <= r ? "on" : "") + "\"></i>"; return s; };
  const dots = r => "<span class=\"dots r" + r + "\" aria-label=\"Надійність " + r + " з 5\">" + dotsHtml(r) + "</span>";

  /* ---------- Обчислення ---------- */
  function visibleStages(i) {
    const tags = G.tagsFor(i.cfg);
    return CL.map(s => Object.assign({}, s, { items: s.items.filter(it => !it.only || it.only.every(t => tags.has(t))) }));
  }
  function computeReport(i) {
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
  function stageProgress(i, stages) {
    return stages.map(s => {
      let answered = 0;
      s.items.forEach(it => { const a = i.answers[it.id]; if (a && a.s) answered++; });
      return { answered, total: s.items.length };
    });
  }

  /* ---------- Навігація ---------- */
  let navDir = "fwd", depth = 0, cur = { id: null, n: 0 }, curBack = null;
  const scroller = () => app.querySelector(".screen");
  function go(hash) {
    navDir = "fwd";
    if (location.hash === hash) { render(); return; }
    depth++;
    location.hash = hash;
  }
  function back(fallback) {
    navDir = "back";
    if (depth > 0) { depth--; history.back(); }
    else location.replace(fallback);
  }
  const parse = () => location.hash.replace(/^#\/?/, "").split("/").map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });

  function render(opts) {
    opts = opts || {};
    const p = parse(), r = p[0] || "";
    let v;
    curBack = null;
    try {
      if (r === "new") v = viewNew();
      else if (r === "guide") v = p[1] ? viewEngine(p[1]) : viewGuide();
      else if (r === "car") v = viewCar(p[1]);
      else if (r === "check") v = viewCheck(p[1], parseInt(p[2] || "0", 10) || 0);
      else if (r === "report") v = viewReport(p[1]);
      else v = viewHome();
    } catch (e) { console.error(e); v = viewHome(); }
    if (!v) v = viewHome();
    const old = scroller();
    const y = opts.soft && old ? old.scrollTop : 0;
    const cls = opts.soft ? "soft" : navDir;
    const tab = v.bar ? null : (v.tab || null);
    app.innerHTML = "<div class=\"screen " + cls + (v.bar ? " has-bar" : tab ? " has-tabs" : "") + "\">" + v.html + "</div>" +
      (v.bar ? "<div class=\"bar\" id=\"bar\"><div class=\"bar-in\">" + v.bar + "</div></div>" : "");
    document.body.classList.toggle("with-bar", !!v.bar);
    document.body.classList.toggle("with-tabs", !!tab);
    setTabs(tab);
    const s = scroller();
    if (s) s.scrollTop = y;
    navDir = "fwd";
    const b = curBack;
    TG.setBack(b ? () => back(b) : null);
    afterRender();
  }
  function afterRender() {
    const s = scroller();
    if (s) syncNav(s);
    app.querySelectorAll("textarea.textarea").forEach(autosize);
    const curStage = document.querySelector("#stages .stage.current");
    if (curStage && curStage.scrollIntoView) curStage.scrollIntoView({ block: "nearest", inline: "center" });
    if (scrollTarget) {
      const el = document.getElementById(scrollTarget);
      scrollTarget = null;
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }));
    }
  }
  function syncNav(s) {
    const n = document.getElementById("nav"); if (!n) return;
    n.classList.toggle("scrolled", s.scrollTop > 4);
    n.classList.toggle("titled", s.scrollTop > 44);
  }
  /* Скрол живе всередині .screen, тому слухаємо у фазі захоплення. */
  app.addEventListener("scroll", e => { if (e.target && e.target.classList && e.target.classList.contains("screen")) syncNav(e.target); }, true);
  /* iOS: коли скролер стоїть на самому краю, тягнення передається документу і сторінка «відривається».
     Відступаємо на 1px від краю, а на нескрольованих ділянках гасимо жест. */
  app.addEventListener("touchstart", e => {
    const s = e.target.closest && e.target.closest(".screen"); if (!s) return;
    if (s.scrollTop <= 0) s.scrollTop = 1;
    else if (s.scrollTop + s.clientHeight >= s.scrollHeight) s.scrollTop = s.scrollHeight - s.clientHeight - 1;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    const t = e.target.closest ? e.target.closest(".screen, .stages, .textarea, .sheet") : null;
    if (!t || (t.classList.contains("screen") && t.scrollHeight <= t.clientHeight)) e.preventDefault();
  }, { passive: false });

  /* ---------- Вкладки знизу ---------- */
  const TABS = [
    { id: "home", to: "#/", label: "Перевірки", icon: "clipboard" },
    { id: "new", to: "#/new", label: "Нова", icon: "circlePlus" },
    { id: "guide", to: "#/guide", label: "Довідник", icon: "book" }
  ];
  const tabsEl = document.createElement("nav");
  tabsEl.className = "tabs"; tabsEl.id = "tabs"; tabsEl.hidden = true; tabsEl.setAttribute("aria-label", "Розділи");
  tabsEl.innerHTML = "<div class=\"tabs-in\">" + TABS.map(t => "<button class=\"tab\" data-tab=\"" + t.id + "\" data-to=\"" + t.to + "\">" + icon(t.icon) + "<span>" + t.label + "</span></button>").join("") + "</div>";
  document.body.appendChild(tabsEl);
  tabsEl.addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) switchTab(b.dataset.to); });
  function setTabs(tab) {
    tabsEl.hidden = !tab;
    tabsEl.querySelectorAll(".tab").forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }
  /* Перемикання вкладки не пише історію (як у нативних апках); повторний тап на активній — скрол угору. */
  function switchTab(to) {
    const h = location.hash || "#/";
    if (h === to || (to === "#/" && h === "#")) {
      const s = scroller(); if (s) s.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
      return;
    }
    TG.haptic("select");
    navDir = "tab";
    location.replace(to);
  }

  function nav(o) {
    curBack = o.back != null ? o.back : null;
    return "<header class=\"nav\" id=\"nav\"><div class=\"nav-row\">" +
      "<div>" + (o.back != null ? "<button class=\"nav-btn\" data-action=\"back\" data-to=\"" + esc(o.back) + "\" aria-label=\"Назад\">" + icon("back") + "<span>" + esc(o.backLabel || "Назад") + "</span></button>" : "") + "</div>" +
      "<div class=\"nav-title" + (o.sub ? " stacked" : "") + (o.titleOnScroll ? " on-scroll" : "") + "\">" + esc(o.title || "") + (o.sub ? "<span class=\"nav-sub\">" + esc(o.sub) + "</span>" : "") + "</div>" +
      "<div>" + (o.right || "") + "</div></div>" + (o.extra || "") + "</header>";
  }

  /* ---------- Дім ---------- */
  function viewHome() {
    const list = db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    const active = list.filter(i => !i.done), done = list.filter(i => i.done);
    let html = nav({ title: "Golf Check", titleOnScroll: true });
    html += "<div class=\"content\"><h1 class=\"large-title\">Golf Check</h1>" +
      "<p class=\"lead\">Чек-лист огляду Volkswagen Golf V перед покупкою. Без діагностики й товщиноміра: очі, руки, вуха.</p>" +
      "<button class=\"btn hero-btn\" data-action=\"tab\" data-to=\"#/new\">" + icon("plus") + " Нова перевірка</button>";
    if (!list.length) {
      html += "<div class=\"empty\"><div class=\"ico\">" + icon("clipboard", "lg") + "</div><h2>Ще немає перевірок</h2><p>Обери мотор, рік і кузов — отримаєш картку моделі з хворобами, ціною і покроковий огляд.</p></div>";
    } else {
      if (active.length) html += "<h2 class=\"section-h\">В процесі</h2><div class=\"group\">" + active.map(inspRow).join("") + "</div>";
      if (done.length) html += "<h2 class=\"section-h\">Завершені</h2><div class=\"group\">" + done.map(inspRow).join("") + "</div>";
    }
    html += installCard();
    html += "<p class=\"foot\" style=\"text-align:center;margin-top:28px\">Дані зберігаються лише на цьому телефоні.</p></div>";
    return { html, tab: "home" };
  }
  function inspRow(i) {
    const rep = computeReport(i);
    const to = i.done ? "#/report/" + i.id : "#/check/" + i.id + "/" + (i.stage || 0);
    const title = i.name || G.label(i.cfg);
    const sub = (i.name ? G.label(i.cfg) + " · " : "") + dateStr(i.createdAt);
    return "<div class=\"insp-wrap\"><button class=\"insp\" data-action=\"go\" data-to=\"" + to + "\">" +
      "<div class=\"insp-main\"><div class=\"insp-t\">" + esc(title) + "</div><div class=\"insp-s\">" + esc(sub) + "</div>" +
      (i.done ? "" : "<div class=\"progress\"><i style=\"transform:scaleX(" + (rep.answeredAll / rep.total).toFixed(3) + ")\"></i></div>") + "</div>" +
      (i.done ? verdictBadge(rep) : "<span class=\"badge badge-progress num\">" + rep.answeredAll + "/" + rep.total + "</span>") +
      "</button><button class=\"more\" data-action=\"menu\" data-id=\"" + i.id + "\" aria-label=\"Дії\">" + icon("more") + "</button></div>";
  }
  const verdictBadge = rep => "<span class=\"badge badge-" + rep.verdict + "\">" + VERDICTS[rep.verdict].short + "</span>";
  function installCard() {
    const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (standalone || db.hideInstall || TG.active) return "";
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return "<div class=\"install\">" + icon("share") + "<div><b>Додай на Початковий екран</b><br>" +
      (ios ? "У Safari натисни «Поділитися», потім «На Початковий екран». Апка працюватиме офлайн, як звичайна." : "Відкрий цю сторінку в Safari на iPhone і додай на Початковий екран через меню «Поділитися».") +
      "</div><button class=\"x\" data-action=\"hide-install\" aria-label=\"Сховати підказку\">" + icon("x", "sm") + "</button></div>";
  }

  /* ---------- Нова перевірка ---------- */
  const emptyDraft = () => ({ fuel: null, engine: null, body: null, year: null, gear: null, name: "", price: "" });
  let draft = emptyDraft(), scrollTarget = null;
  function viewNew() {
    let html = nav({ title: "Нова перевірка" }) + "<div class=\"content\">";
    html += step(1, "Паливо", chips([{ id: "petrol", name: "Бензин" }, { id: "diesel", name: "Дизель" }], draft.fuel, "fuel"), "s-fuel", true);
    if (draft.fuel) {
      const engines = G.ENGINES.filter(e => e.fuel === draft.fuel);
      html += step(2, "Двигун", "<div class=\"group\">" + engines.map(e => optEngine(e, draft.engine === e.id)).join("") + "</div>", "s-engine");
    }
    if (draft.engine) {
      const e = G.engine(draft.engine);
      html += step(3, "Кузов", chips(e.bodies.map(id => { const b = G.body(id); return { id: b.id, name: b.name }; }), draft.body, "body"), "s-body");
    }
    if (draft.body) {
      const years = G.yearsFor(draft.engine, draft.body);
      html += step(4, "Рік випуску", chips(years.map(y => ({ id: String(y), name: String(y) })), draft.year ? String(draft.year) : null, "year") +
        "<p class=\"hint\">Модельний рік за VIN (10-й символ) може бути на 1 більшим за рік у техпаспорті.</p>", "s-year");
    }
    if (draft.year) {
      const gears = G.gearsFor(draft.engine, draft.year);
      html += step(5, "Коробка передач", chips(gears.map(g => ({ id: g.id, name: g.name })), draft.gear, "gear"), "s-gear");
    }
    if (draft.gear) {
      html += step(6, "Про це авто", "<div class=\"fields\">" +
        "<label class=\"field\"><span class=\"foot\" style=\"display:block;margin:0 4px 6px\">Назва (необов'язково)</span><input class=\"input\" data-field=\"name\" value=\"" + esc(draft.name) + "\" placeholder=\"Синій, Київ, з auto.ria\" autocomplete=\"off\"></label>" +
        "<label class=\"field\"><span class=\"foot\" style=\"display:block;margin:0 4px 6px\">Ціна продавця, $ (необов'язково)</span><input class=\"input num\" data-field=\"price\" value=\"" + esc(draft.price) + "\" placeholder=\"6500\" inputmode=\"numeric\" autocomplete=\"off\"></label>" +
        "</div><div class=\"btn-stack\"><button class=\"btn\" data-action=\"create\">Далі: картка моделі " + icon("chev") + "</button></div>", "s-final");
    }
    html += "</div>";
    return { html, tab: "new" };
  }
  const step = (n, title, inner, id, first) => "<section id=\"" + id + "\"><h2 class=\"section-h" + (first ? " first" : "") + "\">" + n + ". " + esc(title) + "</h2>" + inner + "</section>";
  const chips = (list, sel, key) => "<div class=\"chips\">" + list.map(o => "<button class=\"chip" + (sel === o.id ? " on" : "") + "\" data-action=\"draft\" data-k=\"" + key + "\" data-v=\"" + esc(o.id) + "\" aria-pressed=\"" + (sel === o.id) + "\">" + esc(o.name) + "</button>").join("") + "</div>";
  function optEngine(e, on) {
    return "<button class=\"opt" + (on ? " on" : "") + "\" data-action=\"draft\" data-k=\"engine\" data-v=\"" + e.id + "\" aria-pressed=\"" + on + "\">" +
      "<div class=\"opt-top\"><span class=\"opt-name\">" + esc(e.name) + "</span><span class=\"opt-hp\">" + esc(e.hp) + "</span><span class=\"check\">" + icon("circleCheck") + "</span></div>" +
      "<div class=\"opt-sub\">" + esc(e.codes) + "</div>" +
      "<div class=\"opt-meta\">" + dots(e.reliability) + "<span>" + e.years[0] + "–" + e.years[1] + "</span><span class=\"num\">" + costStr(e.price) + "</span></div></button>";
  }
  function setDraft(k, v) {
    if (k === "fuel") { if (draft.fuel !== v) draft = Object.assign(emptyDraft(), { fuel: v, name: draft.name, price: draft.price }); }
    else if (k === "engine") {
      draft.engine = v;
      const e = G.engine(v);
      if (!e.bodies.includes(draft.body)) draft.body = null;
      if (draft.body && !G.yearsFor(v, draft.body).includes(draft.year)) draft.year = null;
      if (!draft.year || !G.gearsFor(v, draft.year).some(g => g.id === draft.gear)) draft.gear = null;
    }
    else if (k === "body") {
      draft.body = v;
      if (!G.yearsFor(draft.engine, v).includes(draft.year)) draft.year = null;
      if (!draft.year) draft.gear = null;
    }
    else if (k === "year") {
      draft.year = parseInt(v, 10);
      if (!G.gearsFor(draft.engine, draft.year).some(g => g.id === draft.gear)) draft.gear = null;
    }
    else if (k === "gear") draft.gear = v;
    scrollTarget = !draft.engine ? "s-engine" : !draft.body ? "s-body" : !draft.year ? "s-year" : !draft.gear ? "s-gear" : "s-final";
    render({ soft: true });
  }
  function create() {
    if (!draft.gear) return;
    const i = {
      id: uid(), createdAt: Date.now(), updatedAt: Date.now(),
      name: String(draft.name || "").trim().slice(0, 60),
      price: parseInt(String(draft.price || "").replace(/\D/g, ""), 10) || 0,
      cfg: { engine: draft.engine, body: draft.body, year: draft.year, gear: draft.gear },
      answers: {}, stage: 0, done: false
    };
    db.inspections.push(i); save();
    draft = emptyDraft();
    go("#/car/" + i.id);
  }

  /* ---------- Картка моделі ---------- */
  function viewCar(id) {
    const i = insp(id); if (!i) return null;
    const e = G.engine(i.cfg.engine), b = G.body(i.cfg.body), g = G.gearbox(i.cfg.gear), price = G.priceFor(i.cfg);
    const rep = computeReport(i);
    let html = nav({ back: "#/", title: "Картка моделі" }) + "<div class=\"content\">" +
      "<div class=\"model-head\"><div class=\"kicker\">Volkswagen Golf V</div><h1>" + esc(e.name) + " · " + i.cfg.year + "</h1>" +
      "<p class=\"sub\">" + esc(b.name) + " · " + esc(g.name) + (i.name ? " · " + esc(i.name) : "") + "</p></div>" +
      priceBlock(i, price) + engineBlock(e) + gearBlock(g) +
      "<h2 class=\"section-h\">Кузов: " + esc(b.name) + "</h2><div class=\"group\"><div class=\"row-block sub\">" + esc(b.note) + "</div></div>" +
      commonBlock() + kitBlock() + "</div>";
    const bar = "<button class=\"btn\" data-action=\"go\" data-to=\"#/check/" + i.id + "/" + (i.stage || 0) + "\">" + (rep.answeredAll ? "Продовжити огляд" : "Почати огляд") + " " + icon("chev") + "</button>";
    return { html, bar };
  }
  function priceBlock(i, price) {
    let cmp = "";
    if (i.price) {
      let cls = "text-good", txt = "у межах ринку";
      if (i.price > price.hi) { cls = "text-bad"; txt = "на " + money(i.price - price.hi) + " вище верхньої межі"; }
      else if (i.price < price.lo) { cls = "text-warn"; txt = "нижче ринку на " + money(price.lo - i.price) + " — спитай, чому"; }
      cmp = "<div class=\"price-cmp\"><span class=\"muted\">Продавець:</span><b class=\"num\">" + money(i.price) + "</b><span class=\"" + cls + "\">· " + txt + "</span></div>";
    }
    return "<h2 class=\"section-h\">Ринкова ціна в Україні</h2><div class=\"group\"><div class=\"price-card\">" +
      "<div class=\"price-big num\">" + money(price.lo) + " – " + fmtN(price.hi) + "</div>" +
      "<p class=\"sub\" style=\"margin-top:6px\">Орієнтовно для цієї конфігурації. Середня по всіх Golf V на auto.ria — " + money(G.MARKET.avg) + " (" + esc(G.MARKET.updated) + "). Дизель дорожчий, бензин дешевший, ГБО — найдешевше.</p>" + cmp +
      "<p style=\"margin-top:12px\"><a class=\"foot\" style=\"display:inline-flex;align-items:center;gap:6px;font-weight:500\" href=\"" + G.MARKET.search + "\" target=\"_blank\" rel=\"noopener\">Актуальні оголошення на auto.ria " + icon("external", "sm") + "</a></p></div></div>";
  }
  function engineBlock(e) {
    const lpg = { ok: "підходить", hard: "невигідно й ризиковано", no: "не ставити" }[e.lpg];
    return "<h2 class=\"section-h\">Двигун " + esc(e.name) + "</h2><div class=\"group\">" +
      "<div class=\"row-block\"><p class=\"body\">" + esc(e.summary) + "</p><p class=\"sub\" style=\"margin-top:8px\"><b class=\"strong\" style=\"color:var(--label)\">Вердикт:</b> " + esc(e.verdict) + "</p></div>" +
      "<div class=\"row-block\"><dl class=\"kv\"><dt>Потужність</dt><dd>" + esc(e.hp) + "</dd><dt>Коди</dt><dd>" + esc(e.codes) + "</dd><dt>ГРМ</dt><dd>" + esc(e.timing.text) + "</dd>" +
      "<dt>Надійність</dt><dd style=\"display:flex;align-items:center;gap:8px\">" + dots(e.reliability) + "<span class=\"muted\">" + e.reliability + " з 5</span></dd><dt>ГБО</dt><dd>" + esc(lpg) + "</dd></dl></div></div>" +
      "<h2 class=\"section-h\">Типові проблеми цього мотора</h2><div class=\"group\">" + e.issues.map(issueRow).join("") + "</div>";
  }
  const issueRow = x => "<div class=\"issue\"><span class=\"dot " + x.sev + "\"></span><div class=\"row-main\"><div class=\"issue-t\">" + esc(x.t) + "</div><div class=\"issue-d\">" + esc(x.d) + "</div></div>" + (x.cost && x.cost[1] ? "<span class=\"issue-c\">" + costStr(x.cost) + "</span>" : "") + "</div>";
  function gearBlock(g) {
    return "<h2 class=\"section-h\">Коробка: " + esc(g.short) + "</h2><div class=\"group\"><div class=\"row-block\"><p class=\"body\">" + esc(g.summary) + "</p><p class=\"sub\" style=\"margin-top:8px;display:flex;align-items:center;gap:8px\">" + dots(g.reliability) + "надійність " + g.reliability + " з 5</p></div>" + g.issues.map(issueRow).join("") + "</div>";
  }
  function commonBlock() {
    return "<h2 class=\"section-h\">Спільні хвороби Golf V</h2><div class=\"group\"><details class=\"acc\"><summary>" + icon("wrench") + "<span>Кузов, електрика, підвіска</span><span class=\"muted\" style=\"margin-left:auto;font-size:15px\">" + G.COMMON.length + "</span>" + icon("chev", "chev") + "</summary>" +
      G.COMMON.map(x => "<div class=\"issue\"><span class=\"dot\"></span><div class=\"row-main\"><div class=\"issue-t\">" + esc(x.t) + "</div><div class=\"issue-d\">" + esc(x.d) + "</div></div>" + (x.cost[1] ? "<span class=\"issue-c\">" + costStr(x.cost) + "</span>" : "") + "</div>").join("") + "</details></div>";
  }
  function kitBlock() {
    return "<h2 class=\"section-h\">Що взяти з собою</h2><div class=\"group\"><div class=\"row-block\"><ul class=\"list\">" + G.KIT.map(k => "<li>" + esc(k) + "</li>").join("") + "</ul></div></div>";
  }
  function vinBlock() {
    return "<h2 class=\"section-h\">VIN, роки і заводи</h2><div class=\"group\"><div class=\"row-block sub\">" + esc(G.VIN.intro) + "</div>" +
      "<div class=\"row-block\"><dl class=\"kv\">" + G.VIN.rows.map(r => "<dt class=\"num\">" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") + "</dl></div>" +
      "<div class=\"row-block\"><div class=\"foot strong\" style=\"margin-bottom:6px\">ДЕ ШУКАТИ VIN</div><ul class=\"list\">" + G.VIN.places.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul></div>" +
      "<div class=\"row-block\"><div class=\"foot strong\" style=\"margin-bottom:6px\">ЗАВОДИ (11-Й СИМВОЛ)</div><dl class=\"kv\">" + G.PLANTS.map(p => "<dt>" + esc(p.code) + "</dt><dd>" + esc(p.name) + " <span class=\"muted\">— " + esc(p.note) + "</span></dd>").join("") + "</dl></div></div>";
  }

  /* ---------- Довідник ---------- */
  function viewGuide() {
    const engRow = e => "<button class=\"row\" data-action=\"go\" data-to=\"#/guide/" + e.id + "\"><div class=\"row-main\"><div class=\"row-t\">" + esc(e.name) + " <span class=\"muted\">" + esc(e.hp) + "</span></div><div class=\"row-s\" style=\"display:flex;align-items:center;gap:10px;flex-wrap:wrap\">" + dots(e.reliability) + "<span class=\"num\">" + costStr(e.price) + "</span><span>" + e.years[0] + "–" + e.years[1] + "</span></div></div>" + icon("chev", "chev") + "</button>";
    let html = nav({ title: "Довідник Golf V" }) + "<div class=\"content\">" +
      "<p class=\"lead\" style=\"padding-top:8px\">Все про п'яте покоління: мотори, коробки, кузови, ціни і хвороби. Обери мотор, щоб побачити повну картку.</p>" +
      "<h2 class=\"section-h first\">Бензинові двигуни</h2><div class=\"group\">" + G.ENGINES.filter(e => e.fuel === "petrol").map(engRow).join("") + "</div>" +
      "<h2 class=\"section-h\">Дизельні двигуни</h2><div class=\"group\">" + G.ENGINES.filter(e => e.fuel === "diesel").map(engRow).join("") + "</div>" +
      "<h2 class=\"section-h\">Коробки передач</h2><div class=\"group\">" + G.GEARBOXES.map(g => "<details class=\"acc\"><summary><span>" + esc(g.name) + "</span>" + dots(g.reliability) + icon("chev", "chev") + "</summary><div class=\"acc-body\">" + esc(g.summary) + "</div>" + g.issues.map(issueRow).join("") + "</details>").join("") + "</div>" +
      "<h2 class=\"section-h\">Кузови</h2><div class=\"group\">" + G.BODIES.map(b => "<div class=\"row-block\"><div class=\"row-t strong\">" + esc(b.name) + " <span class=\"muted\" style=\"font-weight:400\">" + b.years[0] + "–" + b.years[1] + "</span></div><div class=\"row-s\">" + esc(b.note) + "</div></div>").join("") + "</div>" +
      "<h2 class=\"section-h\">Комплектації</h2><div class=\"group\">" + G.TRIMS.map(t => "<div class=\"row-block\"><div class=\"row-t strong\">" + esc(t.name) + "</div><div class=\"row-s\">" + esc(t.note) + "</div></div>").join("") + "</div>" +
      commonBlock() + vinBlock() + kitBlock() +
      "<p class=\"foot\" style=\"text-align:center;margin-top:24px\">Ціни орієнтовні, за даними auto.ria (" + esc(G.MARKET.updated) + ").</p></div>";
    return { html, tab: "guide" };
  }
  function viewEngine(id) {
    const e = G.engine(id); if (!e) return viewGuide();
    const price = G.priceFor({ engine: e.id, body: "h5", year: e.years[1] });
    let html = nav({ back: "#/guide", backLabel: "Довідник", title: e.name }) + "<div class=\"content\">" +
      "<div class=\"model-head\"><div class=\"kicker\">" + (e.fuel === "diesel" ? "Дизель" : "Бензин") + " · " + e.years[0] + "–" + e.years[1] + "</div><h1>" + esc(e.name) + "</h1><p class=\"sub\">" + esc(e.codes) + "</p></div>" +
      "<h2 class=\"section-h\">Ринкова ціна</h2><div class=\"group\"><div class=\"price-card\"><div class=\"price-big num\">" + money(price.lo) + " – " + fmtN(price.hi) + "</div><p class=\"sub\" style=\"margin-top:6px\">Для 5-дверного хетчбека " + e.years[1] + " року. Кузов, рік і коробка змінюють ціну на 5–15 %.</p></div></div>" +
      engineBlock(e) +
      "<h2 class=\"section-h\">Доступні комбінації</h2><div class=\"group\"><div class=\"row-block\"><dl class=\"kv\"><dt>Кузови</dt><dd>" + e.bodies.map(b => esc(G.body(b).name)).join(", ") + "</dd><dt>Коробки</dt><dd>" + e.gears.map(g => esc(G.gearbox(g).name)).join("; ") + "</dd></dl></div></div>" +
      "<div class=\"btn-stack\" style=\"margin-top:24px\"><button class=\"btn\" data-action=\"new-from\" data-id=\"" + e.id + "\">" + icon("plus") + " Нова перевірка з цим мотором</button></div></div>";
    return { html, tab: "guide" };
  }

  /* ---------- Чек-лист ---------- */
  function viewCheck(id, n) {
    const i = insp(id); if (!i) return null;
    const stages = visibleStages(i);
    n = clamp(n, 0, stages.length - 1);
    if (i.stage !== n) { i.stage = n; save(); }
    cur = { id, n };
    const st = stages[n], tags = G.tagsFor(i.cfg), prog = stageProgress(i, stages);
    const overall = prog.reduce((s, p) => s + p.answered, 0) / prog.reduce((s, p) => s + p.total, 0);
    let html = nav({ back: "#/car/" + id, backLabel: "Картка", title: st.name, sub: "Етап " + (n + 1) + " з " + stages.length,
      extra: "<div class=\"progress\"><i id=\"prog\" style=\"transform:scaleX(" + overall.toFixed(3) + ")\"></i></div>" });
    html += "<div class=\"stages\" id=\"stages\">" + stages.map((s, k) => stageChip(s, k, n, prog[k], id)).join("") + "</div>";
    html += "<div class=\"content\"><div class=\"intro\">" + icon("info") + "<span>" + esc(st.intro) + "</span></div>" +
      "<div class=\"items\">" + st.items.map((it, k) => itemCard(it, k, i, tags)).join("") + "</div></div>";
    return { html, bar: barHtml(i, stages, n) };
  }
  function stageChip(s, k, n, p, id) {
    const cls = k === n ? "current" : p.answered >= p.total ? "done" : p.answered ? "part" : "";
    return "<button class=\"stage " + cls + "\" data-action=\"go\" data-to=\"#/check/" + id + "/" + k + "\" aria-current=\"" + (k === n) + "\"><b>" + (p.answered >= p.total && k !== n ? icon("check") : k + 1) + "</b>" + esc(s.short) + "</button>";
  }
  function barHtml(i, stages, n) {
    const t = stageProgress(i, stages)[n], last = n === stages.length - 1;
    return "<div class=\"bar-status\"><span>Відповіли <b class=\"num\">" + t.answered + " з " + t.total + "</b></span>" +
      (n > 0 ? "<button class=\"btn ghost sm\" data-action=\"go\" data-to=\"#/check/" + i.id + "/" + (n - 1) + "\">" + icon("back", "sm") + " " + esc(stages[n - 1].short) + "</button>" : "") + "</div>" +
      "<button class=\"btn\" data-action=\"" + (last ? "finish" : "go") + "\" data-to=\"#/check/" + i.id + "/" + (n + 1) + "\" data-id=\"" + i.id + "\">" + (last ? "Сформувати звіт" : "Далі: " + esc(stages[n + 1].short)) + " " + icon("chev") + "</button>";
  }
  function itemCard(it, k, i, tags) {
    const a = i.answers[it.id] || {}, s = a.s || "";
    const notes = Object.keys(it.notes || {}).filter(t => tags.has(t)).map(t => "<div class=\"note\">" + icon("alert") + "<span>" + esc(it.notes[t]) + "</span></div>").join("");
    const tagChips = (it.tags || []).map(t => "<button class=\"chip small tag" + (a.tags && a.tags.includes(t) ? " on" : "") + "\" data-action=\"tag\" data-t=\"" + esc(t) + "\" aria-pressed=\"" + !!(a.tags && a.tags.includes(t)) + "\">" + esc(t) + "</button>").join("");
    const ans = (key, label, ic) => "<button class=\"ans ans-" + key + (s === key ? " on" : "") + "\" data-action=\"answer\" data-s=\"" + key + "\" aria-pressed=\"" + (s === key) + "\">" + icon(ic) + " " + label + "</button>";
    return "<article class=\"item\" data-item=\"" + it.id + "\" data-s=\"" + s + "\">" +
      "<div class=\"item-top\"><span class=\"item-idx\">" + (k + 1) + "</span><span class=\"sev sev-" + it.sev + "\">" + SEV_LABEL[it.sev] + "</span></div>" +
      "<h3 class=\"item-t\">" + esc(it.t) + "</h3><p class=\"how\">" + esc(it.how) + "</p>" + notes +
      "<details class=\"why\"><summary>" + icon("chev", "sm") + " Чому це важливо</summary><p>" + esc(it.why) + (it.cost && it.cost[1] ? " Орієнтовна вартість усунення: " + costStr(it.cost) + "." : "") + "</p></details>" +
      "<div class=\"answers\" role=\"group\" aria-label=\"Результат перевірки\">" + ans("ok", "Ок", "check") + ans("bad", "Проблема", "x") + ans("skip", "Пропустити", "minus") + "</div>" +
      "<div class=\"comment\"" + (s === "bad" ? "" : " hidden") + ">" + (tagChips ? "<div class=\"chips tags\">" + tagChips + "</div>" : "") +
      "<textarea class=\"textarea\" data-action=\"comment\" rows=\"2\" placeholder=\"Що саме не так? Коротко, для звіту\">" + esc(a.c || "") + "</textarea></div></article>";
  }
  function answer(itemEl, s) {
    const i = insp(cur.id); if (!i || !itemEl) return;
    const id = itemEl.dataset.item;
    const a = i.answers[id] || (i.answers[id] = {});
    a.s = a.s === s ? "" : s;
    TG.haptic("light");
    i.updatedAt = Date.now(); save();
    itemEl.dataset.s = a.s;
    itemEl.querySelectorAll(".ans").forEach(b => { const on = b.dataset.s === a.s; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const c = itemEl.querySelector(".comment");
    if (c) c.hidden = a.s !== "bad";
    refreshProgress();
  }
  function toggleTag(itemEl, btn) {
    const i = insp(cur.id); if (!i || !itemEl) return;
    const a = i.answers[itemEl.dataset.item] || (i.answers[itemEl.dataset.item] = {});
    a.tags = a.tags || [];
    const t = btn.dataset.t, k = a.tags.indexOf(t);
    if (k >= 0) a.tags.splice(k, 1); else a.tags.push(t);
    TG.haptic("select");
    btn.classList.toggle("on", k < 0); btn.setAttribute("aria-pressed", k < 0);
    i.updatedAt = Date.now(); save();
  }
  function setComment(ta) {
    const i = insp(cur.id), itemEl = ta.closest(".item"); if (!i || !itemEl) return;
    const a = i.answers[itemEl.dataset.item] || (i.answers[itemEl.dataset.item] = {});
    a.c = ta.value.slice(0, 500); i.updatedAt = Date.now(); save(); autosize(ta);
  }
  function autosize(ta) { ta.style.height = "auto"; ta.style.height = Math.max(48, ta.scrollHeight) + "px"; }
  function refreshProgress() {
    const i = insp(cur.id); if (!i) return;
    const stages = visibleStages(i), prog = stageProgress(i, stages), n = cur.n;
    const overall = prog.reduce((s, p) => s + p.answered, 0) / prog.reduce((s, p) => s + p.total, 0);
    const pr = document.getElementById("prog"); if (pr) pr.style.transform = "scaleX(" + overall.toFixed(3) + ")";
    document.querySelectorAll("#stages .stage").forEach((el, k) => {
      const p = prog[k], done = p.answered >= p.total;
      el.className = "stage " + (k === n ? "current" : done ? "done" : p.answered ? "part" : "");
      el.querySelector("b").innerHTML = done && k !== n ? icon("check") : String(k + 1);
    });
    const bar = document.querySelector("#bar .bar-in"); if (bar) bar.innerHTML = barHtml(i, stages, n);
  }
  function finish(id) {
    const i = insp(id); if (!i) return;
    i.done = true; i.updatedAt = Date.now(); save();
    go("#/report/" + id);
  }

  /* ---------- Звіт ---------- */
  function viewReport(id) {
    const i = insp(id); if (!i) return null;
    const rep = computeReport(i), price = G.priceFor(i.cfg), V = VERDICTS[rep.verdict];
    let html = nav({ back: "#/", backLabel: "Перевірки", title: "Звіт" }) + "<div class=\"content\">" +
      "<div class=\"model-head\"><div class=\"kicker\">" + esc(i.name || "Golf V") + "</div><h1>" + esc(G.label(i.cfg)) + "</h1><p class=\"sub\">" + dateStr(i.updatedAt) + "</p></div>" +
      "<div class=\"verdict " + rep.verdict + "\" style=\"margin-top:12px\">" + ring(rep.score) + "<div><div class=\"verdict-t\">" + V.t + "</div><div class=\"verdict-s\">" + V.s(rep) + "</div></div></div>" +
      "<div class=\"stats\"><div class=\"stat ok\"><b>" + rep.ok + "</b><span>ок</span></div><div class=\"stat bad\"><b>" + rep.failCount + "</b><span>проблем</span></div><div class=\"stat\"><b>" + (rep.skipped.length + rep.unanswered.length) + "</b><span>не перевірено</span></div></div>";
    if (rep.cost.hi > 0) html += "<h2 class=\"section-h\">Бюджет на усунення</h2><div class=\"group\"><div class=\"price-card\"><div class=\"price-big num\">≈ " + costStr([rep.cost.lo, rep.cost.hi]) + "</div><p class=\"sub\" style=\"margin-top:6px\">Сума орієнтовних вартостей по знайдених проблемах. Це твій аргумент у торгу." + (i.price ? " Від ціни " + money(i.price) + " справедливо просити " + money(Math.max(0, i.price - rep.cost.hi)) + "–" + fmtN(Math.max(0, i.price - rep.cost.lo)) + "." : "") + "</p></div></div>";
    html += priceBlock(i, price);
    [["crit", "Критичні проблеми"], ["major", "Важливі зауваження"], ["minor", "Дрібниці"]].forEach(([k, title]) => {
      if (rep.fails[k].length) html += "<h2 class=\"section-h\">" + title + " · " + rep.fails[k].length + "</h2><div class=\"group\">" + rep.fails[k].map(repRow).join("") + "</div>";
    });
    if (!rep.failCount) html += "<h2 class=\"section-h\">Проблеми</h2><div class=\"group\"><div class=\"row-block sub\">Проблем не зафіксовано. Якщо огляд був повним — це дуже добрий знак.</div></div>";
    const rest = rep.skipped.concat(rep.unanswered);
    if (rest.length) html += "<h2 class=\"section-h\">Не перевірено · " + rest.length + "</h2><div class=\"group\"><details class=\"acc\"><summary><span>Показати список</span>" + icon("chev", "chev") + "</summary><div class=\"acc-body\"><ul class=\"list\">" + rest.map(x => "<li>" + esc(x.it.t) + " <span class=\"muted\">· " + esc(x.stage.short) + "</span></li>").join("") + "</ul></div></details></div>";
    html += "<div class=\"btn-stack\" style=\"margin-top:24px\">" +
      "<button class=\"btn\" data-action=\"share\" data-id=\"" + i.id + "\">" + icon("share") + " Поділитися звітом</button>" +
      "<button class=\"btn secondary\" data-action=\"go\" data-to=\"#/check/" + i.id + "/0\">Повернутись до чек-листа</button>" +
      "<button class=\"btn ghost danger\" data-action=\"delete\" data-id=\"" + i.id + "\">Видалити перевірку</button></div>" +
      "<p class=\"foot\" style=\"text-align:center;margin-top:16px\">Звіт — орієнтир, а не експертиза. Для остаточного рішення покажи авто на СТО.</p></div>";
    return { html, tab: "home" };
  }
  const repRow = f => "<div class=\"rep-item\"><div class=\"t\">" + esc(f.it.t) + "</div>" +
    (f.a.tags && f.a.tags.length ? "<div class=\"tagline\">" + f.a.tags.map(t => "<span>" + esc(t) + "</span>").join("") + "</div>" : "") +
    (f.a.c ? "<div class=\"c\">" + esc(f.a.c) + "</div>" : "") +
    "<div class=\"m\">" + esc(f.stage.short) + (f.it.cost && f.it.cost[1] ? " · ≈ " + costStr(f.it.cost) : "") + "</div></div>";
  function ring(score) {
    const C = 2 * Math.PI * 36, off = C * (1 - score / 100);
    return "<div class=\"ring\" role=\"img\" aria-label=\"Оцінка " + score + " зі 100\"><svg viewBox=\"0 0 84 84\"><circle class=\"bgc\" cx=\"42\" cy=\"42\" r=\"36\"/><circle class=\"fgc\" cx=\"42\" cy=\"42\" r=\"36\" style=\"stroke-dasharray:" + C.toFixed(1) + ";--off:" + off.toFixed(1) + "\"/></svg><div class=\"val\">" + score + "</div></div>";
  }
  function reportText(i) {
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
  async function share(id) {
    const i = insp(id); if (!i) return;
    const text = reportText(i);
    if (TG.active) {
      sheet({ title: "Поділитися звітом", actions: [
        { label: icon("share") + " Надіслати в Telegram", fn: () => TG.share(text) },
        { label: "Скопіювати текст", fn: () => copy(text) }
      ] });
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: "Golf Check — звіт", text }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    copy(text);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Звіт скопійовано"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Звіт скопійовано"); } catch (e2) { toast("Не вдалося скопіювати"); }
      ta.remove();
    }
  }

  /* ---------- Меню, аркуш, тост ---------- */
  function menu(id) {
    const i = insp(id); if (!i) return;
    const actions = [
      { label: icon("car") + " Картка моделі", fn: () => go("#/car/" + id) },
      { label: icon("clipboard") + " Чек-лист", fn: () => go("#/check/" + id + "/" + (i.stage || 0)) },
      { label: icon("share") + " Звіт", fn: () => go("#/report/" + id) },
      { label: "Перейменувати", fn: () => rename(id) },
      { label: icon("trash") + " Видалити", danger: true, fn: () => confirmDelete(id) }
    ];
    sheet({ title: i.name || G.label(i.cfg), actions });
  }
  function rename(id) {
    const i = insp(id); if (!i) return;
    sheet({ title: "Назва перевірки", input: { value: i.name || "", placeholder: G.label(i.cfg) }, actions: [{ label: "Зберегти", fn: v => {
      i.name = String(v || "").trim().slice(0, 60); i.updatedAt = Date.now(); save(); render({ soft: true });
    } }] });
  }
  function confirmDelete(id) {
    const i = insp(id); if (!i) return;
    sheet({ title: "Видалити перевірку «" + (i.name || G.label(i.cfg)) + "»? Це незворотно.", actions: [{ label: "Видалити", danger: true, fn: () => {
      db.inspections = db.inspections.filter(x => x.id !== id); save();
      if ((parse()[0] || "") !== "") { navDir = "back"; location.replace("#/"); } else render({ soft: true });
      toast("Перевірку видалено");
    } }] });
  }
  function sheet(o) {
    const scrim = document.createElement("div"); scrim.className = "scrim";
    const sh = document.createElement("div"); sh.className = "sheet"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
    sh.innerHTML = "<div class=\"sheet-in\"><div class=\"sheet-group\">" + (o.title ? "<div class=\"sheet-title\">" + esc(o.title) + "</div>" : "") +
      (o.input ? "<div class=\"sheet-field\"><input class=\"input\" value=\"" + esc(o.input.value || "") + "\" placeholder=\"" + esc(o.input.placeholder || "") + "\" maxlength=\"60\" autocomplete=\"off\" enterkeyhint=\"done\"></div>" : "") +
      o.actions.map((a, k) => "<button class=\"sheet-btn" + (a.danger ? " danger" : "") + "\" data-k=\"" + k + "\">" + a.label + "</button>").join("") +
      "</div><div class=\"sheet-group\"><button class=\"sheet-btn cancel\" data-k=\"-1\">Скасувати</button></div></div>";
    document.body.append(scrim, sh);
    const inputEl = sh.querySelector("input");
    let closed = false;
    const close = () => { if (closed) return; closed = true; scrim.classList.add("closing"); sh.classList.add("closing"); setTimeout(() => { scrim.remove(); sh.remove(); }, 260); };
    const run = k => { const val = inputEl ? inputEl.value : undefined; close(); if (k >= 0 && o.actions[k].fn) setTimeout(() => o.actions[k].fn(val), 40); };
    scrim.addEventListener("click", close);
    sh.addEventListener("click", e => {
      if (closed) return;
      const b = e.target.closest("[data-k]"); if (!b) return;
      run(parseInt(b.dataset.k, 10));
    });
    if (inputEl) {
      inputEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); run(0); } });
      setTimeout(() => { try { inputEl.focus(); inputEl.select(); } catch (e) { /* iOS без жесту */ } }, 60);
    }
    const onKey = e => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
  }
  let toastEl = null, toastT = null;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    clearTimeout(toastT);
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
    document.body.append(t); toastEl = t;
    toastT = setTimeout(() => { t.classList.add("closing"); setTimeout(() => { t.remove(); if (toastEl === t) toastEl = null; }, 250); }, 2200);
  }

  /* ---------- Події ---------- */
  app.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (a && TG.active && /^https?:/i.test(a.href) && TG.openLink(a.href)) { e.preventDefault(); return; }
    const el = e.target.closest("[data-action]"); if (!el) return;
    switch (el.dataset.action) {
      case "go": go(el.dataset.to); break;
      case "tab": switchTab(el.dataset.to); break;
      case "back": back(el.dataset.to || "#/"); break;
      case "draft": setDraft(el.dataset.k, el.dataset.v); break;
      case "create": create(); break;
      case "answer": answer(el.closest(".item"), el.dataset.s); break;
      case "tag": toggleTag(el.closest(".item"), el); break;
      case "finish": finish(el.dataset.id); break;
      case "share": share(el.dataset.id); break;
      case "delete": confirmDelete(el.dataset.id); break;
      case "menu": menu(el.dataset.id); break;
      case "hide-install": db.hideInstall = true; save(); render({ soft: true }); break;
      case "new-from": { const en = G.engine(el.dataset.id); draft = Object.assign(emptyDraft(), { fuel: en.fuel, engine: en.id }); scrollTarget = "s-body"; switchTab("#/new"); break; }
      default: break;
    }
  });
  app.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset.action === "comment") setComment(el);
    else if (el.dataset.field) draft[el.dataset.field] = el.value;
  });
  window.addEventListener("hashchange", () => render());
  window.addEventListener("pageshow", ev => { if (ev.persisted) { db = load(); render({ soft: true }); } });
  TG.onReady(() => render({ soft: true }));
  render();
})();
