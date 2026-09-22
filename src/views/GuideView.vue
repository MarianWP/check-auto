<script setup>
import { computed, ref } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import DotsRating from "../components/DotsRating.vue";
import EngineRow from "../components/EngineRow.vue";
import IssueRow from "../components/IssueRow.vue";
import ChipGroup from "../components/ChipGroup.vue";
import ProfileButton from "../components/ProfileButton.vue";
import CommonBlock from "../components/CommonBlock.vue";
import VinBlock from "../components/VinBlock.vue";
import KitBlock from "../components/KitBlock.vue";
import DraftNotice from "../components/DraftNotice.vue";
import { MODELS, modelApi, DEFAULT_MODEL } from "../data/index.js";
import { photosFor } from "../cloud/content";
import { reduced } from "../store";

const MODEL_OPTS = MODELS.map(m => ({ id: m.id, name: m.brand + " " + m.name + (m.draft ? " (чернетка)" : "") }));
const GKEY = "golfcheck.guideModel";
const sel = ref((() => { try { return MODELS.some(m => m.id === localStorage.getItem(GKEY)) ? localStorage.getItem(GKEY) : DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; } })());
function pickModel(_k, v) { sel.value = v; try { localStorage.setItem(GKEY, v); } catch (e) { /* немає доступу */ } }
const G = computed(() => modelApi(sel.value));
const petrol = computed(() => G.value.ENGINES.filter(e => e.fuel === "petrol"));
const diesel = computed(() => G.value.ENGINES.filter(e => e.fuel === "diesel"));
const gearboxes = computed(() => { const used = new Set(G.value.ENGINES.flatMap(e => e.gears)); return G.value.GEARBOXES.filter(g => used.has(g.id)); });
/* Швидкий перехід до розділу: довідник довгий, потрібний двигун не мусить ховатися за прокруткою. */
const JUMP = [
  { id: "sec-petrol", name: "Бензин" }, { id: "sec-diesel", name: "Дизель" }, { id: "sec-gears", name: "Коробки" },
  { id: "sec-bodies", name: "Кузови" }, { id: "sec-trims", name: "Комплектації" }, { id: "sec-common", name: "Хвороби" },
  { id: "sec-vin", name: "VIN" }, { id: "sec-kit", name: "Що взяти" }
];
function jump(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar root />
    <div class="content" :class="enter">
      <header class="page-head head-row">
        <div><p class="kicker">{{ G.model.brand }} · {{ G.model.years[0] }}–{{ G.model.years[1] }}</p><h1 class="title">Довідник</h1></div>
        <ProfileButton />
      </header>
      <header class="page-head" style="padding-top: 0">
        <p class="lead" style="margin-top: 0">Двигуни, коробки, кузови, ціни і хвороби. Обери модель, потім двигун, щоб побачити повну картку.</p>
      </header>
      <ChipGroup :list="MODEL_OPTS" :sel="sel" k="model" label="Модель" @pick="pickModel" />
      <DraftNotice :model="sel" />
      <nav class="jump" aria-label="Розділи довідника">
        <button v-for="j in JUMP" :key="j.id" class="chip" data-action="jump" :data-to="j.id" @click="jump(j.id)">{{ j.name }}</button>
      </nav>

      <div :key="sel">
        <section id="sec-petrol" class="anchor" aria-labelledby="h-petrol">
          <h2 id="h-petrol" class="h2">Бензинові двигуни</h2>
          <div class="group"><EngineRow v-for="e in petrol" :key="e.id" :e="e" :model="sel" /></div>
        </section>
        <section id="sec-diesel" class="anchor" aria-labelledby="h-diesel">
          <h2 id="h-diesel" class="h2">Дизельні двигуни</h2>
          <div class="group"><EngineRow v-for="e in diesel" :key="e.id" :e="e" :model="sel" /></div>
        </section>
        <section id="sec-gears" class="anchor" aria-labelledby="h-gears">
          <h2 id="h-gears" class="h2">Коробки передач</h2>
          <div class="group">
            <details v-for="g in gearboxes" :key="g.id" class="acc">
              <summary><span class="grow">{{ g.name }}<span class="engine-meta"><DotsRating :r="g.reliability" /><span>{{ g.reliability }} з 5</span></span></span><AppIcon name="chevDown" cls="turn" /></summary>
              <div class="acc-body">{{ g.summary }}</div>
              <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x" :photos="photosFor('gearbox', g.id, k)" />
            </details>
          </div>
        </section>
        <section id="sec-bodies" class="anchor" aria-labelledby="h-bodies">
          <h2 id="h-bodies" class="h2">Кузови</h2>
          <div class="group"><div v-for="b in G.BODIES" :key="b.id" class="row-block"><h3 class="row-t">{{ b.name }} <span class="muted" style="font-weight: 450">{{ b.years[0] }}–{{ b.years[1] }}</span></h3><p class="issue-d">{{ b.note }}</p></div></div>
        </section>
        <section id="sec-trims" class="anchor" aria-labelledby="h-trims">
          <h2 id="h-trims" class="h2">Комплектації</h2>
          <div class="group"><div v-for="t in G.TRIMS" :key="t.name" class="row-block"><h3 class="row-t">{{ t.name }}</h3><p class="issue-d">{{ t.note }}</p></div></div>
        </section>
        <CommonBlock :model="sel" />
        <VinBlock :model="sel" />
        <KitBlock :model="sel" />
      </div>
      <p class="foot center" style="margin-top: var(--s5)">Ціни орієнтовні, за даними auto.ria ({{ G.MARKET.updated }}).</p>
    </div>
  </AppScreen>
</template>
