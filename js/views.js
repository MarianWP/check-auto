/* Golf Check — сторінки (маршрути): дім, нова перевірка, картка моделі, довідник, мотор, чек-лист, звіт. */
window.GC = window.GC || {};
(function (GC) {
  "use strict";
  const { computed, onMounted, nextTick } = Vue;
  const { useRoute } = VueRouter;
  const G = window.GOLF;
  const C = GC.components = GC.components || {};
  const V = GC.views = {};

  /* ---------- Дім ---------- */
  V.Home = {
    setup() {
      const db = GC.db;
      const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
      const active = computed(() => list.value.filter(i => !i.done));
      const done = computed(() => list.value.filter(i => i.done));
      const hasAny = computed(() => list.value.length > 0);
      return { active, done, hasAny };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar title="Golf Check" title-on-scroll/>
  <div class="content" :class="enter">
    <h1 class="large-title">Golf Check</h1>
    <p class="lead">Чек-лист огляду Volkswagen Golf V перед покупкою. Без діагностики й товщиноміра: очі, руки, вуха.</p>
    <button class="btn hero-btn" data-action="tab" data-to="/new" @click="$gc.switchTab('/new')"><Icon name="plus"/><span>Нова перевірка</span></button>
    <div v-if="!hasAny" class="empty"><div class="ico"><Icon name="clipboard" cls="lg"/></div><h2>Ще немає перевірок</h2><p>Обери мотор, рік і кузов — отримаєш картку моделі з хворобами, ціною і покроковий огляд.</p></div>
    <template v-else>
      <template v-if="active.length"><h2 class="section-h">В процесі</h2><div class="group"><InspRow v-for="i in active" :key="i.id" :i="i"/></div></template>
      <template v-if="done.length"><h2 class="section-h">Завершені</h2><div class="group"><InspRow v-for="i in done" :key="i.id" :i="i"/></div></template>
    </template>
    <InstallCard/>
    <p class="foot" style="text-align:center;margin-top:28px">Дані зберігаються лише на цьому телефоні.</p>
  </div>
</Screen>`
  };

  /* ---------- Нова перевірка ---------- */
  V.NewCheck = {
    setup() {
      const d = GC.draft;
      const FUELS = [{ id: "petrol", name: "Бензин" }, { id: "diesel", name: "Дизель" }];
      const engines = computed(() => d.fuel ? G.ENGINES.filter(e => e.fuel === d.fuel) : []);
      const bodies = computed(() => d.engine ? G.engine(d.engine).bodies.map(id => { const b = G.body(id); return { id: b.id, name: b.name }; }) : []);
      const years = computed(() => d.body ? G.yearsFor(d.engine, d.body).map(y => ({ id: String(y), name: String(y) })) : []);
      const gears = computed(() => d.year ? G.gearsFor(d.engine, d.year).map(g => ({ id: g.id, name: g.name })) : []);
      const yearSel = computed(() => d.year ? String(d.year) : null);
      function scrollTo(id) {
        nextTick(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: GC.reduced() ? "auto" : "smooth", block: "start" });
        });
      }
      function pick(k, v) { scrollTo(GC.setDraft(k, v)); }
      function create() { const i = GC.createInspection(); if (i) GC.go("/car/" + i.id); }
      onMounted(() => {
        const t = GC.ui.scrollTarget;
        if (t) { GC.ui.scrollTarget = null; requestAnimationFrame(() => scrollTo(t)); }
      });
      return { d, FUELS, engines, bodies, years, gears, yearSel, pick, create };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar title="Нова перевірка"/>
  <div class="content" :class="enter">
    <section id="s-fuel"><h2 class="section-h first">1. Паливо</h2><Chips :list="FUELS" :sel="d.fuel" k="fuel" @pick="pick"/></section>
    <section v-if="d.fuel" id="s-engine"><h2 class="section-h">2. Двигун</h2><div class="group">
      <button v-for="e in engines" :key="e.id" class="opt" :class="{ on: d.engine === e.id }" data-action="draft" data-k="engine" :data-v="e.id" :aria-pressed="d.engine === e.id" @click="pick('engine', e.id)">
        <div class="opt-top"><span class="opt-name">{{ e.name }}</span><span class="opt-hp">{{ e.hp }}</span><span class="check"><Icon name="circleCheck"/></span></div>
        <div class="opt-sub">{{ e.codes }}</div>
        <div class="opt-meta"><Dots :r="e.reliability"/><span>{{ e.years[0] }}–{{ e.years[1] }}</span><span class="num">{{ $gc.costStr(e.price) }}</span></div>
      </button>
    </div></section>
    <section v-if="d.engine" id="s-body"><h2 class="section-h">3. Кузов</h2><Chips :list="bodies" :sel="d.body" k="body" @pick="pick"/></section>
    <section v-if="d.body" id="s-year"><h2 class="section-h">4. Рік випуску</h2><Chips :list="years" :sel="yearSel" k="year" @pick="pick"/><p class="hint">Модельний рік за VIN (10-й символ) може бути на 1 більшим за рік у техпаспорті.</p></section>
    <section v-if="d.year" id="s-gear"><h2 class="section-h">5. Коробка передач</h2><Chips :list="gears" :sel="d.gear" k="gear" @pick="pick"/></section>
    <section v-if="d.gear" id="s-final"><h2 class="section-h">6. Про це авто</h2>
      <div class="fields">
        <label class="field"><span class="foot" style="display:block;margin:0 4px 6px">Назва (необов'язково)</span><input class="input" data-field="name" v-model="d.name" maxlength="60" placeholder="Синій, Київ, з auto.ria" autocomplete="off"></label>
        <label class="field"><span class="foot" style="display:block;margin:0 4px 6px">Ціна продавця, $ (необов'язково)</span><input class="input num" data-field="price" v-model="d.price" placeholder="6500" inputmode="numeric" autocomplete="off"></label>
      </div>
      <div class="btn-stack"><button class="btn" data-action="create" @click="create"><span>Далі: картка моделі</span><Icon name="chev"/></button></div>
    </section>
  </div>
</Screen>`
  };

  /* ---------- Картка моделі ---------- */
  V.Car = {
    setup() {
      const route = useRoute();
      const i = GC.insp(String(route.params.id));
      const e = G.engine(i.cfg.engine), b = G.body(i.cfg.body), g = G.gearbox(i.cfg.gear), price = G.priceFor(i.cfg);
      const rep = computed(() => GC.computeReport(i));
      const checkTo = computed(() => "/check/" + i.id + "/" + (i.stage || 0));
      return { i, e, b, g, price, rep, checkTo };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar back="/" title="Картка моделі"/>
  <div class="content" :class="enter">
    <div class="model-head"><div class="kicker">Volkswagen Golf V</div><h1>{{ e.name }} · {{ i.cfg.year }}</h1><p class="sub">{{ b.name }} · {{ g.name }}<template v-if="i.name"> · {{ i.name }}</template></p></div>
    <PriceBlock :i="i" :price="price"/>
    <EngineBlock :e="e"/>
    <GearBlock :g="g"/>
    <h2 class="section-h">Кузов: {{ b.name }}</h2><div class="group"><div class="row-block sub">{{ b.note }}</div></div>
    <CommonBlock/>
    <KitBlock/>
  </div>
</Screen>
<div class="bar" id="bar"><div class="bar-in"><button class="btn" data-action="go" :data-to="checkTo" @click="$gc.go(checkTo)"><span>{{ rep.answeredAll ? 'Продовжити огляд' : 'Почати огляд' }}</span><Icon name="chev"/></button></div></div>`
  };

  /* ---------- Довідник ---------- */
  C.EngineRow = {
    props: { e: Object },
    template: `<button class="row" data-action="go" :data-to="'/guide/' + e.id" @click="$gc.go('/guide/' + e.id)">
  <div class="row-main"><div class="row-t">{{ e.name }} <span class="muted">{{ e.hp }}</span></div>
    <div class="row-s" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><Dots :r="e.reliability"/><span class="num">{{ $gc.costStr(e.price) }}</span><span>{{ e.years[0] }}–{{ e.years[1] }}</span></div></div>
  <Icon name="chev" cls="chev"/>
</button>`
  };
  V.Guide = {
    setup() {
      return {
        petrol: G.ENGINES.filter(e => e.fuel === "petrol"), diesel: G.ENGINES.filter(e => e.fuel === "diesel"),
        gearboxes: G.GEARBOXES, bodies: G.BODIES, trims: G.TRIMS, M: G.MARKET
      };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar title="Довідник Golf V"/>
  <div class="content" :class="enter">
    <p class="lead" style="padding-top:8px">Все про п'яте покоління: мотори, коробки, кузови, ціни і хвороби. Обери мотор, щоб побачити повну картку.</p>
    <h2 class="section-h first">Бензинові двигуни</h2><div class="group"><EngineRow v-for="e in petrol" :key="e.id" :e="e"/></div>
    <h2 class="section-h">Дизельні двигуни</h2><div class="group"><EngineRow v-for="e in diesel" :key="e.id" :e="e"/></div>
    <h2 class="section-h">Коробки передач</h2><div class="group"><details v-for="g in gearboxes" :key="g.id" class="acc"><summary><span>{{ g.name }}</span><Dots :r="g.reliability"/><Icon name="chev" cls="chev"/></summary><div class="acc-body">{{ g.summary }}</div><IssueRow v-for="(x, k) in g.issues" :key="k" :x="x"/></details></div>
    <h2 class="section-h">Кузови</h2><div class="group"><div v-for="b in bodies" :key="b.id" class="row-block"><div class="row-t strong">{{ b.name }} <span class="muted" style="font-weight:400">{{ b.years[0] }}–{{ b.years[1] }}</span></div><div class="row-s">{{ b.note }}</div></div></div>
    <h2 class="section-h">Комплектації</h2><div class="group"><div v-for="t in trims" :key="t.name" class="row-block"><div class="row-t strong">{{ t.name }}</div><div class="row-s">{{ t.note }}</div></div></div>
    <CommonBlock/>
    <VinBlock/>
    <KitBlock/>
    <p class="foot" style="text-align:center;margin-top:24px">Ціни орієнтовні, за даними auto.ria ({{ M.updated }}).</p>
  </div>
</Screen>`
  };

  /* ---------- Мотор ---------- */
  V.Engine = {
    setup() {
      const route = useRoute();
      const e = G.engine(String(route.params.id));
      const price = G.priceFor({ engine: e.id, body: "h5", year: e.years[1] });
      const bodies = e.bodies.map(b => G.body(b).name).join(", ");
      const gears = e.gears.map(g => G.gearbox(g).name).join("; ");
      function newFrom() { GC.resetDraft({ fuel: e.fuel, engine: e.id }); GC.ui.scrollTarget = "s-body"; GC.switchTab("/new"); }
      return { e, price, bodies, gears, newFrom, fuelLabel: e.fuel === "diesel" ? "Дизель" : "Бензин" };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar back="/guide" back-label="Довідник" :title="e.name"/>
  <div class="content" :class="enter">
    <div class="model-head"><div class="kicker">{{ fuelLabel }} · {{ e.years[0] }}–{{ e.years[1] }}</div><h1>{{ e.name }}</h1><p class="sub">{{ e.codes }}</p></div>
    <h2 class="section-h">Ринкова ціна</h2><div class="group"><div class="price-card"><div class="price-big num">{{ $gc.money(price.lo) }} – {{ $gc.fmtN(price.hi) }}</div><p class="sub" style="margin-top:6px">Для 5-дверного хетчбека {{ e.years[1] }} року. Кузов, рік і коробка змінюють ціну на 5–15 %.</p></div></div>
    <EngineBlock :e="e"/>
    <h2 class="section-h">Доступні комбінації</h2><div class="group"><div class="row-block"><dl class="kv"><dt>Кузови</dt><dd>{{ bodies }}</dd><dt>Коробки</dt><dd>{{ gears }}</dd></dl></div></div>
    <div class="btn-stack" style="margin-top:24px"><button class="btn" data-action="new-from" :data-id="e.id" @click="newFrom"><Icon name="plus"/><span>Нова перевірка з цим мотором</span></button></div>
  </div>
</Screen>`
  };

  /* ---------- Чек-лист ---------- */
  V.Check = {
    setup() {
      const route = useRoute();
      const id = String(route.params.id);
      const i = GC.insp(id);
      const stages = GC.visibleStages(i);
      const n = GC.clamp(parseInt(route.params.n || "0", 10) || 0, 0, stages.length - 1);
      if (i.stage !== n) i.stage = n;
      const st = stages[n], tags = G.tagsFor(i.cfg), last = n === stages.length - 1;
      const prog = computed(() => GC.stageProgress(i, stages));
      const overall = computed(() => { const p = prog.value; return p.reduce((s, x) => s + x.answered, 0) / p.reduce((s, x) => s + x.total, 0); });
      const cur = computed(() => prog.value[n]);
      const ANSWERS = [{ s: "ok", label: "Ок", icon: "check" }, { s: "bad", label: "Проблема", icon: "x" }, { s: "skip", label: "Пропустити", icon: "minus" }];
      const ans = it => i.answers[it.id] || {};
      const hasTag = (it, t) => { const a = ans(it); return !!(a.tags && a.tags.includes(t)); };
      const noteTags = it => Object.keys(it.notes || {}).filter(t => tags.has(t));
      const costWhy = it => it.cost && it.cost[1] ? " Орієнтовна вартість усунення: " + GC.costStr(it.cost) + "." : "";
      const stageCls = k => { const p = prog.value[k]; return k === n ? "current" : p.answered >= p.total ? "done" : p.answered ? "part" : ""; };
      const stageDone = k => k !== n && prog.value[k].answered >= prog.value[k].total;
      function answer(it, s) { GC.answer(i, it.id, s); window.TG.haptic("light"); }
      function toggleTag(it, t) { GC.toggleTag(i, it.id, t); window.TG.haptic("select"); }
      function setComment(it, ev) { GC.setComment(i, it.id, ev.target.value); }
      function finish() { GC.finish(i); GC.go("/report/" + id); }
      onMounted(() => { const c = document.querySelector("#stages .stage.current"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "center" }); });
      return { id, i, stages, n, st, last, prog, overall, cur, ANSWERS, SEV: GC.SEV_LABEL, ans, hasTag, noteTags, costWhy, stageCls, stageDone, answer, toggleTag, setComment, finish };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar :back="'/car/' + id" back-label="Картка" :title="st.name" :sub="'Етап ' + (n + 1) + ' з ' + stages.length">
    <template #extra><div class="progress"><i id="prog" :style="{ transform: 'scaleX(' + overall.toFixed(3) + ')' }"></i></div></template>
  </NavBar>
  <div class="stages" id="stages"><button v-for="(s, k) in stages" :key="s.id" class="stage" :class="stageCls(k)" data-action="go" :data-to="'/check/' + id + '/' + k" :aria-current="k === n" @click="$gc.go('/check/' + id + '/' + k)"><b><Icon v-if="stageDone(k)" name="check"/><template v-else>{{ k + 1 }}</template></b>{{ s.short }}</button></div>
  <div class="content" :class="enter">
    <div class="intro"><Icon name="info"/><span>{{ st.intro }}</span></div>
    <div class="items">
      <article v-for="(it, k) in st.items" :key="it.id" class="item" :data-item="it.id" :data-s="ans(it).s || ''">
        <div class="item-top"><span class="item-idx">{{ k + 1 }}</span><span class="sev" :class="'sev-' + it.sev">{{ SEV[it.sev] }}</span></div>
        <h3 class="item-t">{{ it.t }}</h3><p class="how">{{ it.how }}</p>
        <div v-for="t in noteTags(it)" :key="t" class="note"><Icon name="alert"/><span>{{ it.notes[t] }}</span></div>
        <details class="why"><summary><Icon name="chev" cls="sm"/> Чому це важливо</summary><p>{{ it.why }}{{ costWhy(it) }}</p></details>
        <div class="answers" role="group" aria-label="Результат перевірки">
          <button v-for="a in ANSWERS" :key="a.s" class="ans" :class="['ans-' + a.s, { on: ans(it).s === a.s }]" data-action="answer" :data-s="a.s" :aria-pressed="ans(it).s === a.s" @click="answer(it, a.s)"><Icon :name="a.icon"/><span>{{ a.label }}</span></button>
        </div>
        <transition name="comment"><div v-show="ans(it).s === 'bad'" class="comment">
          <div v-if="it.tags && it.tags.length" class="chips tags"><button v-for="t in it.tags" :key="t" class="chip small tag" :class="{ on: hasTag(it, t) }" data-action="tag" :data-t="t" :aria-pressed="hasTag(it, t)" @click="toggleTag(it, t)">{{ t }}</button></div>
          <textarea class="textarea" v-autosize data-action="comment" rows="2" maxlength="500" placeholder="Що саме не так? Коротко, для звіту" :value="ans(it).c || ''" @input="setComment(it, $event)"></textarea>
        </div></transition>
      </article>
    </div>
  </div>
</Screen>
<div class="bar" id="bar"><div class="bar-in">
  <div class="bar-status"><span>Відповіли <b class="num">{{ cur.answered }} з {{ cur.total }}</b></span>
    <button v-if="n > 0" class="btn ghost sm" data-action="go" :data-to="'/check/' + id + '/' + (n - 1)" @click="$gc.go('/check/' + id + '/' + (n - 1))"><Icon name="back" cls="sm"/><span>{{ stages[n - 1].short }}</span></button></div>
  <button class="btn" :data-action="last ? 'finish' : 'go'" :data-to="last ? null : '/check/' + id + '/' + (n + 1)" @click="last ? finish() : $gc.go('/check/' + id + '/' + (n + 1))"><span>{{ last ? 'Сформувати звіт' : 'Далі: ' + stages[n + 1].short }}</span><Icon name="chev"/></button>
</div></div>`
  };

  /* ---------- Звіт ---------- */
  V.Report = {
    setup() {
      const route = useRoute();
      const i = GC.insp(String(route.params.id));
      const rep = computed(() => GC.computeReport(i));
      const price = G.priceFor(i.cfg);
      const V = computed(() => GC.VERDICTS[rep.value.verdict]);
      const rest = computed(() => rep.value.skipped.concat(rep.value.unanswered));
      const groups = [["crit", "Критичні проблеми"], ["major", "Важливі зауваження"], ["minor", "Дрібниці"]];
      const fair = computed(() => {
        const r = rep.value;
        if (!i.price) return "";
        return " Від ціни " + GC.money(i.price) + " справедливо просити " + GC.money(Math.max(0, i.price - r.cost.hi)) + "–" + GC.fmtN(Math.max(0, i.price - r.cost.lo)) + ".";
      });
      return { i, rep, price, V, rest, groups, fair, label: G.label(i.cfg) };
    },
    template: `<Screen v-slot="{ enter }">
  <NavBar back="/" back-label="Перевірки" title="Звіт"/>
  <div class="content" :class="enter">
    <div class="model-head"><div class="kicker">{{ i.name || 'Golf V' }}</div><h1>{{ label }}</h1><p class="sub">{{ $gc.dateStr(i.updatedAt) }}</p></div>
    <div class="verdict" :class="rep.verdict" style="margin-top:12px"><Ring :score="rep.score"/><div><div class="verdict-t">{{ V.t }}</div><div class="verdict-s">{{ V.s(rep) }}</div></div></div>
    <div class="stats"><div class="stat ok"><b>{{ rep.ok }}</b><span>ок</span></div><div class="stat bad"><b>{{ rep.failCount }}</b><span>проблем</span></div><div class="stat"><b>{{ rep.skipped.length + rep.unanswered.length }}</b><span>не перевірено</span></div></div>
    <template v-if="rep.cost.hi > 0"><h2 class="section-h">Бюджет на усунення</h2><div class="group"><div class="price-card"><div class="price-big num">≈ {{ $gc.costStr([rep.cost.lo, rep.cost.hi]) }}</div><p class="sub" style="margin-top:6px">Сума орієнтовних вартостей по знайдених проблемах. Це твій аргумент у торгу.{{ fair }}</p></div></div></template>
    <PriceBlock :i="i" :price="price"/>
    <template v-for="[k, title] in groups" :key="k"><template v-if="rep.fails[k].length"><h2 class="section-h">{{ title }} · {{ rep.fails[k].length }}</h2><div class="group">
      <div v-for="f in rep.fails[k]" :key="f.it.id" class="rep-item"><div class="t">{{ f.it.t }}</div>
        <div v-if="f.a.tags && f.a.tags.length" class="tagline"><span v-for="t in f.a.tags" :key="t">{{ t }}</span></div>
        <div v-if="f.a.c" class="c">{{ f.a.c }}</div>
        <div class="m">{{ f.stage.short }}<template v-if="f.it.cost && f.it.cost[1]"> · ≈ {{ $gc.costStr(f.it.cost) }}</template></div></div>
    </div></template></template>
    <template v-if="!rep.failCount"><h2 class="section-h">Проблеми</h2><div class="group"><div class="row-block sub">Проблем не зафіксовано. Якщо огляд був повним — це дуже добрий знак.</div></div></template>
    <template v-if="rest.length"><h2 class="section-h">Не перевірено · {{ rest.length }}</h2><div class="group"><details class="acc"><summary><span>Показати список</span><Icon name="chev" cls="chev"/></summary><div class="acc-body"><ul class="list"><li v-for="x in rest" :key="x.it.id">{{ x.it.t }} <span class="muted">· {{ x.stage.short }}</span></li></ul></div></details></div></template>
    <div class="btn-stack" style="margin-top:24px">
      <button class="btn" data-action="share" :data-id="i.id" @click="$gc.share(i.id)"><Icon name="share"/><span>Поділитися звітом</span></button>
      <button class="btn secondary" data-action="go" :data-to="'/check/' + i.id + '/0'" @click="$gc.go('/check/' + i.id + '/0')">Повернутись до чек-листа</button>
      <button class="btn ghost danger" data-action="delete" :data-id="i.id" @click="$gc.confirmDelete(i.id)">Видалити перевірку</button>
    </div>
    <p class="foot" style="text-align:center;margin-top:16px">Звіт — орієнтир, а не експертиза. Для остаточного рішення покажи авто на СТО.</p>
  </div>
</Screen>`
  };
})(window.GC);
