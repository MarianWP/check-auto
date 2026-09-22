<script setup>
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import SpecTiles from "../components/SpecTiles.vue";
import EngineBlock from "../components/EngineBlock.vue";
import DraftNotice from "../components/DraftNotice.vue";
import { modelApi } from "../data/index.js";
import { money, fmtN, resetDraft, ui } from "../store";
import { switchTab } from "../nav";

const route = useRoute();
const model = String(route.params.model);
const G = modelApi(model);
const e = G.engine(String(route.params.id));
const refBody = e.bodies[0];
const price = G.priceFor({ engine: e.id, body: refBody, year: e.years[1] });
const bodies = e.bodies.map(b => G.body(b).name).join(", ");
const gears = e.gears.map(g => G.gearbox(g).name).join("; ");
const fuelLabel = e.fuel === "diesel" ? "Дизель" : "Бензин";
function newFrom() { resetDraft({ model, fuel: e.fuel, engine: e.id }); ui.scrollTarget = "s-body"; switchTab("/new"); }
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/guide" back-label="довідник" :title="e.name" :kicker="G.model.name + ' · ' + fuelLabel + ' · ' + e.years[0] + '–' + e.years[1]" :lead="e.codes" />
    <div class="content" :class="enter">
      <DraftNotice :model="model" />
      <SpecTiles :e="e" style="margin-top: var(--s4)" />
      <section aria-labelledby="h-eprice">
        <h2 id="h-eprice" class="h2">Ринкова ціна</h2>
        <div class="card price">
          <div class="price-v">{{ money(price.lo) }} – {{ fmtN(price.hi) }}</div>
          <p class="foot">Для кузова «{{ G.body(refBody).name }}» {{ e.years[1] }} року. Кузов, рік і коробка змінюють ціну на 5–15 %.</p>
        </div>
      </section>
      <EngineBlock :e="e" />
      <section aria-labelledby="h-combos">
        <h2 id="h-combos" class="h2">Доступні комбінації</h2>
        <div class="card"><dl class="kv"><dt>Кузови</dt><dd>{{ bodies }}</dd><dt>Коробки</dt><dd>{{ gears }}</dd></dl></div>
      </section>
      <div class="btn-stack"><button class="btn" data-action="new-from" :data-id="e.id" @click="newFrom"><AppIcon name="plus" /><span>Новий огляд із цим двигуном</span></button></div>
    </div>
  </AppScreen>
</template>
