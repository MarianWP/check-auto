/* Golf Check — доменні блоки, спільні для кількох сторінок: рядок перевірки, ціна, двигун, коробка, хвороби, VIN, кільце оцінки. */
window.GC = window.GC || {};
(function (GC) {
  "use strict";
  const { computed } = Vue;
  const G = window.GOLF;
  const C = GC.components = GC.components || {};

  C.InspRow = {
    props: { i: Object },
    setup(props) {
      const rep = computed(() => GC.computeReport(props.i));
      const to = computed(() => props.i.done ? "/report/" + props.i.id : "/check/" + props.i.id + "/" + (props.i.stage || 0));
      const title = computed(() => props.i.name || G.label(props.i.cfg));
      const sub = computed(() => (props.i.name ? G.label(props.i.cfg) + " · " : "") + GC.dateStr(props.i.createdAt));
      return { rep, to, title, sub, V: GC.VERDICTS };
    },
    template: `<div class="insp-wrap">
  <button class="insp" data-action="go" :data-to="to" @click="$gc.go(to)">
    <div class="insp-main"><div class="insp-t">{{ title }}</div><div class="insp-s">{{ sub }}</div>
      <div v-if="!i.done" class="progress"><i :style="{ transform: 'scaleX(' + (rep.answeredAll / rep.total).toFixed(3) + ')' }"></i></div></div>
    <span v-if="i.done" class="badge" :class="'badge-' + rep.verdict">{{ V[rep.verdict].short }}</span>
    <span v-else class="badge badge-progress num">{{ rep.answeredAll }}/{{ rep.total }}</span>
  </button>
  <button class="more" data-action="menu" :data-id="i.id" @click="$gc.menu(i.id)" aria-label="Дії"><Icon name="more"/></button>
</div>`
  };

  C.InstallCard = {
    setup() {
      const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const show = computed(() => !standalone && !GC.db.hideInstall && !window.TG.active);
      return { show, ios };
    },
    template: `<div v-if="show" class="install"><Icon name="share"/><div><b>Додай на Початковий екран</b><br>
  <template v-if="ios">У Safari натисни «Поділитися», потім «На Початковий екран». Апка працюватиме офлайн, як звичайна.</template>
  <template v-else>Відкрий цю сторінку в Safari на iPhone і додай на Початковий екран через меню «Поділитися».</template>
  </div><button class="x" data-action="hide-install" @click="$gc.hideInstall()" aria-label="Сховати підказку"><Icon name="x" cls="sm"/></button></div>`
  };

  C.IssueRow = {
    props: { x: Object },
    template: `<div class="issue"><span class="dot" :class="x.sev || ''"></span><div class="row-main"><div class="issue-t">{{ x.t }}</div><div class="issue-d">{{ x.d }}</div></div><span v-if="x.cost && x.cost[1]" class="issue-c">{{ $gc.costStr(x.cost) }}</span></div>`
  };

  C.PriceBlock = {
    props: { i: Object, price: Object },
    setup(props) {
      const cmp = computed(() => {
        const i = props.i, p = props.price;
        if (!i.price) return null;
        if (i.price > p.hi) return { cls: "text-bad", txt: "на " + GC.money(i.price - p.hi) + " вище верхньої межі" };
        if (i.price < p.lo) return { cls: "text-warn", txt: "нижче ринку на " + GC.money(p.lo - i.price) + " — спитай, чому" };
        return { cls: "text-good", txt: "у межах ринку" };
      });
      return { cmp, M: G.MARKET };
    },
    template: `<h2 class="section-h">Ринкова ціна в Україні</h2><div class="group"><div class="price-card">
  <div class="price-big num">{{ $gc.money(price.lo) }} – {{ $gc.fmtN(price.hi) }}</div>
  <p class="sub" style="margin-top:6px">Орієнтовно для цієї конфігурації. Середня по всіх Golf V на auto.ria — {{ $gc.money(M.avg) }} ({{ M.updated }}). Дизель дорожчий, бензин дешевший, ГБО — найдешевше.</p>
  <div v-if="cmp" class="price-cmp"><span class="muted">Продавець:</span><b class="num">{{ $gc.money(i.price) }}</b><span :class="cmp.cls">· {{ cmp.txt }}</span></div>
  <p style="margin-top:12px"><a class="foot" style="display:inline-flex;align-items:center;gap:6px;font-weight:500" :href="M.search" target="_blank" rel="noopener">Актуальні оголошення на auto.ria <Icon name="external" cls="sm"/></a></p>
</div></div>`
  };

  C.EngineBlock = {
    props: { e: Object },
    setup(props) {
      const lpg = computed(() => ({ ok: "підходить", hard: "невигідно й ризиковано", no: "не ставити" })[props.e.lpg]);
      return { lpg };
    },
    template: `<h2 class="section-h">Двигун {{ e.name }}</h2><div class="group">
  <div class="row-block"><p class="body">{{ e.summary }}</p><p class="sub" style="margin-top:8px"><b class="strong" style="color:var(--label)">Вердикт:</b> {{ e.verdict }}</p></div>
  <div class="row-block"><dl class="kv"><dt>Потужність</dt><dd>{{ e.hp }}</dd><dt>Коди</dt><dd>{{ e.codes }}</dd><dt>ГРМ</dt><dd>{{ e.timing.text }}</dd>
    <dt>Надійність</dt><dd style="display:flex;align-items:center;gap:8px"><Dots :r="e.reliability"/><span class="muted">{{ e.reliability }} з 5</span></dd><dt>ГБО</dt><dd>{{ lpg }}</dd></dl></div>
</div>
<h2 class="section-h">Типові проблеми цього мотора</h2><div class="group"><IssueRow v-for="(x, k) in e.issues" :key="k" :x="x"/></div>`
  };

  C.GearBlock = {
    props: { g: Object },
    template: `<h2 class="section-h">Коробка: {{ g.short }}</h2><div class="group">
  <div class="row-block"><p class="body">{{ g.summary }}</p><p class="sub" style="margin-top:8px;display:flex;align-items:center;gap:8px"><Dots :r="g.reliability"/>надійність {{ g.reliability }} з 5</p></div>
  <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x"/>
</div>`
  };

  C.CommonBlock = {
    setup() { return { list: G.COMMON }; },
    template: `<h2 class="section-h">Спільні хвороби Golf V</h2><div class="group"><details class="acc">
  <summary><Icon name="wrench"/><span>Кузов, електрика, підвіска</span><span class="muted" style="margin-left:auto;font-size:15px">{{ list.length }}</span><Icon name="chev" cls="chev"/></summary>
  <IssueRow v-for="(x, k) in list" :key="k" :x="x"/>
</details></div>`
  };

  C.KitBlock = {
    setup() { return { kit: G.KIT }; },
    template: `<h2 class="section-h">Що взяти з собою</h2><div class="group"><div class="row-block"><ul class="list"><li v-for="(k, n) in kit" :key="n">{{ k }}</li></ul></div></div>`
  };

  C.VinBlock = {
    setup() { return { vin: G.VIN, plants: G.PLANTS }; },
    template: `<h2 class="section-h">VIN, роки і заводи</h2><div class="group">
  <div class="row-block sub">{{ vin.intro }}</div>
  <div class="row-block"><dl class="kv"><template v-for="(r, k) in vin.rows" :key="k"><dt class="num">{{ r[0] }}</dt><dd>{{ r[1] }}</dd></template></dl></div>
  <div class="row-block"><div class="foot strong" style="margin-bottom:6px">ДЕ ШУКАТИ VIN</div><ul class="list"><li v-for="(p, k) in vin.places" :key="k">{{ p }}</li></ul></div>
  <div class="row-block"><div class="foot strong" style="margin-bottom:6px">ЗАВОДИ (11-Й СИМВОЛ)</div><dl class="kv"><template v-for="p in plants" :key="p.code"><dt>{{ p.code }}</dt><dd>{{ p.name }} <span class="muted">— {{ p.note }}</span></dd></template></dl></div>
</div>`
  };

  C.Ring = {
    props: { score: Number },
    setup(props) {
      const CIRC = 2 * Math.PI * 36;
      const off = computed(() => (CIRC * (1 - props.score / 100)).toFixed(1));
      return { dash: CIRC.toFixed(1), off };
    },
    template: `<div class="ring" role="img" :aria-label="'Оцінка ' + score + ' зі 100'"><svg viewBox="0 0 84 84"><circle class="bgc" cx="42" cy="42" r="36"/><circle class="fgc" cx="42" cy="42" r="36" :style="{ strokeDasharray: dash, '--off': off }"/></svg><div class="val">{{ score }}</div></div>`
  };
})(window.GC);
