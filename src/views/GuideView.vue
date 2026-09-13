<script setup>
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import DotsRating from "../components/DotsRating.vue";
import EngineRow from "../components/EngineRow.vue";
import IssueRow from "../components/IssueRow.vue";
import CommonBlock from "../components/CommonBlock.vue";
import VinBlock from "../components/VinBlock.vue";
import KitBlock from "../components/KitBlock.vue";
import G from "../data/golf";

const petrol = G.ENGINES.filter(e => e.fuel === "petrol");
const diesel = G.ENGINES.filter(e => e.fuel === "diesel");
const gearboxes = G.GEARBOXES, bodies = G.BODIES, trims = G.TRIMS, M = G.MARKET;
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar title="Довідник Golf V" />
    <div class="content" :class="enter">
      <p class="lead" style="padding-top:8px">Все про п'яте покоління: мотори, коробки, кузови, ціни і хвороби. Обери мотор, щоб побачити повну картку.</p>
      <h2 class="section-h first">Бензинові двигуни</h2>
      <div class="group"><EngineRow v-for="e in petrol" :key="e.id" :e="e" /></div>
      <h2 class="section-h">Дизельні двигуни</h2>
      <div class="group"><EngineRow v-for="e in diesel" :key="e.id" :e="e" /></div>
      <h2 class="section-h">Коробки передач</h2>
      <div class="group">
        <details v-for="g in gearboxes" :key="g.id" class="acc">
          <summary><span>{{ g.name }}</span><DotsRating :r="g.reliability" /><AppIcon name="chev" cls="chev" /></summary>
          <div class="acc-body">{{ g.summary }}</div>
          <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x" />
        </details>
      </div>
      <h2 class="section-h">Кузови</h2>
      <div class="group"><div v-for="b in bodies" :key="b.id" class="row-block"><div class="row-t strong">{{ b.name }} <span class="muted" style="font-weight:400">{{ b.years[0] }}–{{ b.years[1] }}</span></div><div class="row-s">{{ b.note }}</div></div></div>
      <h2 class="section-h">Комплектації</h2>
      <div class="group"><div v-for="t in trims" :key="t.name" class="row-block"><div class="row-t strong">{{ t.name }}</div><div class="row-s">{{ t.note }}</div></div></div>
      <CommonBlock />
      <VinBlock />
      <KitBlock />
      <p class="foot" style="text-align:center;margin-top:24px">Ціни орієнтовні, за даними auto.ria ({{ M.updated }}).</p>
    </div>
  </AppScreen>
</template>
