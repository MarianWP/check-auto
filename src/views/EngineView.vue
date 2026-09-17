<script setup>
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import SpecTiles from "../components/SpecTiles.vue";
import EngineBlock from "../components/EngineBlock.vue";
import G from "../data/golf";
import { money, fmtN, resetDraft, ui } from "../store";
import { switchTab } from "../nav";

const route = useRoute();
const e = G.engine(String(route.params.id));
const price = G.priceFor({ engine: e.id, body: "h5", year: e.years[1] });
const bodies = e.bodies.map(b => G.body(b).name).join(", ");
const gears = e.gears.map(g => G.gearbox(g).name).join("; ");
const fuelLabel = e.fuel === "diesel" ? "Дизель" : "Бензин";
function newFrom() { resetDraft({ fuel: e.fuel, engine: e.id }); ui.scrollTarget = "s-body"; switchTab("/new"); }
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/guide" back-label="довідник" title="Двигун" />
    <div class="content" :class="enter">
      <header class="page-head">
        <p class="kicker">{{ fuelLabel }} · {{ e.years[0] }}–{{ e.years[1] }}</p>
        <h1 class="title">{{ e.name }}</h1>
        <p class="lead">{{ e.codes }}</p>
      </header>
      <SpecTiles :e="e" style="margin-top: var(--s4)" />
      <section aria-labelledby="h-eprice">
        <h2 id="h-eprice" class="h2">Ринкова ціна</h2>
        <div class="card price">
          <div class="price-v">{{ money(price.lo) }} – {{ fmtN(price.hi) }}</div>
          <p class="foot">Для 5-дверного хетчбека {{ e.years[1] }} року. Кузов, рік і коробка змінюють ціну на 5–15 %.</p>
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
