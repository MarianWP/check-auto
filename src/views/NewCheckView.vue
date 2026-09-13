<script setup>
import { computed, nextTick, onMounted } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import DotsRating from "../components/DotsRating.vue";
import ChipGroup from "../components/ChipGroup.vue";
import G from "../data/golf";
import { draft as d, setDraft, createInspection, costStr, reduced, ui } from "../store";
import { go } from "../nav";

const FUELS = [{ id: "petrol", name: "Бензин" }, { id: "diesel", name: "Дизель" }];
const engines = computed(() => d.fuel ? G.ENGINES.filter(e => e.fuel === d.fuel) : []);
const bodies = computed(() => d.engine ? G.engine(d.engine).bodies.map(id => { const b = G.body(id); return { id: b.id, name: b.name }; }) : []);
const years = computed(() => d.body ? G.yearsFor(d.engine, d.body).map(y => ({ id: String(y), name: String(y) })) : []);
const gears = computed(() => d.year ? G.gearsFor(d.engine, d.year).map(g => ({ id: g.id, name: g.name })) : []);
const yearSel = computed(() => d.year ? String(d.year) : null);

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
    <NavBar title="Нова перевірка" />
    <div class="content" :class="enter">
      <section id="s-fuel"><h2 class="section-h first">1. Паливо</h2><ChipGroup :list="FUELS" :sel="d.fuel" k="fuel" @pick="pick" /></section>
      <section v-if="d.fuel" id="s-engine">
        <h2 class="section-h">2. Двигун</h2>
        <div class="group">
          <button v-for="e in engines" :key="e.id" class="opt" :class="{ on: d.engine === e.id }" data-action="draft" data-k="engine" :data-v="e.id" :aria-pressed="d.engine === e.id" @click="pick('engine', e.id)">
            <div class="opt-top"><span class="opt-name">{{ e.name }}</span><span class="opt-hp">{{ e.hp }}</span><span class="check"><AppIcon name="circleCheck" /></span></div>
            <div class="opt-sub">{{ e.codes }}</div>
            <div class="opt-meta"><DotsRating :r="e.reliability" /><span>{{ e.years[0] }}–{{ e.years[1] }}</span><span class="num">{{ costStr(e.price) }}</span></div>
          </button>
        </div>
      </section>
      <section v-if="d.engine" id="s-body"><h2 class="section-h">3. Кузов</h2><ChipGroup :list="bodies" :sel="d.body" k="body" @pick="pick" /></section>
      <section v-if="d.body" id="s-year">
        <h2 class="section-h">4. Рік випуску</h2>
        <ChipGroup :list="years" :sel="yearSel" k="year" @pick="pick" />
        <p class="hint">Модельний рік за VIN (10-й символ) може бути на 1 більшим за рік у техпаспорті.</p>
      </section>
      <section v-if="d.year" id="s-gear"><h2 class="section-h">5. Коробка передач</h2><ChipGroup :list="gears" :sel="d.gear" k="gear" @pick="pick" /></section>
      <section v-if="d.gear" id="s-final">
        <h2 class="section-h">6. Про це авто</h2>
        <div class="fields">
          <label class="field"><span class="foot" style="display:block;margin:0 4px 6px">Назва (необов'язково)</span><input v-model="d.name" class="input" data-field="name" maxlength="60" placeholder="Синій, Київ, з auto.ria" autocomplete="off"></label>
          <label class="field"><span class="foot" style="display:block;margin:0 4px 6px">Ціна продавця, $ (необов'язково)</span><input v-model="d.price" class="input num" data-field="price" placeholder="6500" inputmode="numeric" autocomplete="off"></label>
        </div>
        <div class="btn-stack"><button class="btn" data-action="create" @click="create"><span>Далі: картка моделі</span><AppIcon name="chev" /></button></div>
      </section>
    </div>
  </AppScreen>
</template>
