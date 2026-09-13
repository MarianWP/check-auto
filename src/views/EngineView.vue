<script setup>
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
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
    <NavBar back="/guide" back-label="Довідник" :title="e.name" />
    <div class="content" :class="enter">
      <div class="model-head"><div class="kicker">{{ fuelLabel }} · {{ e.years[0] }}–{{ e.years[1] }}</div><h1>{{ e.name }}</h1><p class="sub">{{ e.codes }}</p></div>
      <h2 class="section-h">Ринкова ціна</h2>
      <div class="group"><div class="price-card"><div class="price-big num">{{ money(price.lo) }} – {{ fmtN(price.hi) }}</div><p class="sub" style="margin-top:6px">Для 5-дверного хетчбека {{ e.years[1] }} року. Кузов, рік і коробка змінюють ціну на 5–15 %.</p></div></div>
      <EngineBlock :e="e" />
      <h2 class="section-h">Доступні комбінації</h2>
      <div class="group"><div class="row-block"><dl class="kv"><dt>Кузови</dt><dd>{{ bodies }}</dd><dt>Коробки</dt><dd>{{ gears }}</dd></dl></div></div>
      <div class="btn-stack" style="margin-top:24px"><button class="btn" data-action="new-from" :data-id="e.id" @click="newFrom"><AppIcon name="plus" /><span>Нова перевірка з цим мотором</span></button></div>
    </div>
  </AppScreen>
</template>
