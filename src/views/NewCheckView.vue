<script setup>
import { computed, nextTick, onMounted } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import DotsRating from "../components/DotsRating.vue";
import ChipGroup from "../components/ChipGroup.vue";
import DraftNotice from "../components/DraftNotice.vue";
import { MODELS, modelApi } from "../data/index.js";
import { FUELS as FUEL_LIST } from "../logic/generated";
import { draft as d, setDraft, createInspection, costStr, reduced, ui } from "../store";
import { go } from "../nav";

const MODEL_OPTS = computed(() => MODELS.map(m => ({ id: m.id, name: m.brand + " " + m.name + (m.draft ? " (чернетка)" : m.ai ? " (ШІ)" : "") })));
const G = computed(() => modelApi(d.model));
/* Види палива лише ті, що є серед двигунів моделі (у картках від ШІ може бути гібрид чи електро). */
const FUELS = computed(() => { const set = new Set(G.value.ENGINES.map(e => e.fuel)); return FUEL_LIST.filter(f => set.has(f.id)); });
const engines = computed(() => d.fuel ? G.value.ENGINES.filter(e => e.fuel === d.fuel) : []);
const bodies = computed(() => d.engine ? G.value.engine(d.engine).bodies.map(id => { const b = G.value.body(id); return { id: b.id, name: b.name }; }) : []);
const years = computed(() => d.body ? G.value.yearsFor(d.engine, d.body).map(y => ({ id: String(y), name: String(y) })) : []);
const gears = computed(() => d.year ? G.value.gearsFor(d.engine, d.year).map(g => ({ id: g.id, name: g.name })) : []);
const yearSel = computed(() => d.year ? String(d.year) : null);

/* Крок, на якому зараз користувач: перший невибраний (7 — останній, про авто). */
const stepNow = computed(() => !d.fuel ? 2 : !d.engine ? 3 : !d.body ? 4 : !d.year ? 5 : !d.gear ? 6 : 7);
const picked = computed(() => ({
  model: G.value.model.name,
  fuel: d.fuel ? (FUEL_LIST.find(f => f.id === d.fuel) || { name: d.fuel }).name : "",
  engine: d.engine ? G.value.engine(d.engine).name : "",
  body: d.body ? G.value.body(d.body).short : "",
  year: d.year ? String(d.year) : "",
  gear: d.gear ? G.value.gearbox(d.gear).short : ""
}));

function scrollTo(id) {
  nextTick(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  });
}
function pick(k, v) { scrollTo(setDraft(k, v)); }
function create() { const i = createInspection(); if (i) go("/car/" + i.id); }
onMounted(() => {
  const t = ui.scrollTarget;
  if (t) { ui.scrollTarget = null; requestAnimationFrame(() => scrollTo(t)); }
});
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar root />
    <div class="content" :class="enter">
      <header class="page-head">
        <p class="kicker">Крок {{ stepNow }} з 7</p>
        <h1 class="title">Новий огляд</h1>
        <p class="lead">Обери модель і конфігурацію авто. Чек-лист підлаштується під двигун і коробку.</p>
      </header>

      <section id="s-model" class="step done" aria-labelledby="st-model">
        <header class="step-head">
          <span class="step-no" aria-hidden="true"><AppIcon name="check" /></span>
          <h2 id="st-model" class="step-t">Модель</h2><span class="step-val">{{ picked.model }}</span>
        </header>
        <ChipGroup :list="MODEL_OPTS" :sel="d.model" k="model" label="Модель" @pick="pick" />
        <button class="row ai-row" data-action="generate" data-to="/generate" @click="go('/generate')">
          <span class="ai-ic" aria-hidden="true"><AppIcon name="sparkles" /></span>
          <span class="row-main"><span class="row-t">Іншого авто немає в списку?</span><span class="row-s">Впиши марку, модель і рік: ШІ складе картку авто і чек-лист саме під нього.</span></span>
          <AppIcon name="chev" cls="chev" />
        </button>
        <DraftNotice :model="d.model" />
      </section>

      <section id="s-fuel" class="step" :class="{ done: !!d.fuel }" aria-labelledby="st-fuel">
        <header class="step-head">
          <span class="step-no" aria-hidden="true"><AppIcon v-if="d.fuel" name="check" /><template v-else>2</template></span>
          <h2 id="st-fuel" class="step-t">Паливо</h2><span v-if="d.fuel" class="step-val">{{ picked.fuel }}</span>
        </header>
        <ChipGroup :list="FUELS" :sel="d.fuel" k="fuel" label="Паливо" @pick="pick" />
      </section>

      <section v-if="d.fuel" id="s-engine" class="step" :class="{ done: !!d.engine }" aria-labelledby="st-engine">
        <header class="step-head">
          <span class="step-no" aria-hidden="true"><AppIcon v-if="d.engine" name="check" /><template v-else>3</template></span>
          <h2 id="st-engine" class="step-t">Двигун</h2><span v-if="d.engine" class="step-val">{{ picked.engine }}</span>
        </header>
        <div class="opts" role="group" aria-label="Двигун">
          <button v-for="e in engines" :key="e.id" class="opt" :class="{ on: d.engine === e.id }" data-action="draft" data-k="engine" :data-v="e.id" :aria-pressed="d.engine === e.id" @click="pick('engine', e.id)">
            <span class="opt-main">
              <span class="opt-top"><span class="opt-name">{{ e.name }}</span><span class="opt-hp">{{ e.hp }}</span></span>
              <span class="opt-sub" style="display: block">{{ e.codes }}</span>
              <span class="opt-meta"><DotsRating :r="e.reliability" /><span>{{ e.reliability }} з 5</span><span>{{ e.years[0] }}–{{ e.years[1] }}</span><span>{{ costStr(e.price) }}</span></span>
            </span>
            <span class="opt-check" aria-hidden="true"><AppIcon name="check" /></span>
          </button>
        </div>
      </section>

      <section v-if="d.engine" id="s-body" class="step" :class="{ done: !!d.body }" aria-labelledby="st-body">
        <header class="step-head">
          <span class="step-no" aria-hidden="true"><AppIcon v-if="d.body" name="check" /><template v-else>4</template></span>
          <h2 id="st-body" class="step-t">Кузов</h2><span v-if="d.body" class="step-val">{{ picked.body }}</span>
        </header>
        <ChipGroup :list="bodies" :sel="d.body" k="body" label="Кузов" @pick="pick" />
      </section>

      <section v-if="d.body" id="s-year" class="step" :class="{ done: !!d.year }" aria-labelledby="st-year">
        <header class="step-head">
          <span class="step-no" aria-hidden="true"><AppIcon v-if="d.year" name="check" /><template v-else>5</template></span>
          <h2 id="st-year" class="step-t">Рік випуску</h2><span v-if="d.year" class="step-val">{{ picked.year }}</span>
        </header>
        <ChipGroup :list="years" :sel="yearSel" k="year" label="Рік випуску" @pick="pick" />
        <p class="hint">Модельний рік за VIN (10-й символ) може бути на 1 більшим за рік у техпаспорті.</p>
      </section>

      <section v-if="d.year" id="s-gear" class="step" :class="{ done: !!d.gear }" aria-labelledby="st-gear">
        <header class="step-head">
          <span class="step-no" aria-hidden="true"><AppIcon v-if="d.gear" name="check" /><template v-else>6</template></span>
          <h2 id="st-gear" class="step-t">Коробка передач</h2><span v-if="d.gear" class="step-val">{{ picked.gear }}</span>
        </header>
        <ChipGroup :list="gears" :sel="d.gear" k="gear" label="Коробка передач" @pick="pick" />
      </section>

      <section v-if="d.gear" id="s-final" class="step" aria-labelledby="st-final">
        <header class="step-head">
          <span class="step-no" aria-hidden="true">7</span>
          <h2 id="st-final" class="step-t">Про це авто</h2>
        </header>
        <div class="card fields">
          <label class="field"><span class="field-label">Назва, щоб упізнати серед інших (необов'язково)</span><input v-model="d.name" class="input" data-field="name" maxlength="60" placeholder="Синій, Київ, з auto.ria" autocomplete="off" enterkeyhint="next"></label>
          <label class="field"><span class="field-label">Ціна продавця, $ (необов'язково)</span><input v-model="d.price" class="input" data-field="price" placeholder="6500" inputmode="numeric" autocomplete="off" enterkeyhint="done"></label>
        </div>
        <div class="btn-stack"><button class="btn" data-action="create" @click="create"><span>Далі: картка авто</span><AppIcon name="arrowRight" /></button></div>
      </section>
    </div>
  </AppScreen>
</template>
