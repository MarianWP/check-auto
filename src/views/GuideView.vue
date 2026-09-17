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
import { reduced } from "../store";

const petrol = G.ENGINES.filter(e => e.fuel === "petrol");
const diesel = G.ENGINES.filter(e => e.fuel === "diesel");
const gearboxes = G.GEARBOXES, bodies = G.BODIES, trims = G.TRIMS, M = G.MARKET;
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
      <header class="page-head">
        <p class="kicker">Volkswagen Golf V · 2003–2009</p>
        <h1 class="title">Довідник</h1>
        <p class="lead">Двигуни, коробки, кузови, ціни і хвороби п'ятого покоління. Обери двигун, щоб побачити повну картку.</p>
      </header>
      <nav class="jump" aria-label="Розділи довідника">
        <button v-for="j in JUMP" :key="j.id" class="chip" data-action="jump" :data-to="j.id" @click="jump(j.id)">{{ j.name }}</button>
      </nav>

      <section id="sec-petrol" class="anchor" aria-labelledby="h-petrol">
        <h2 id="h-petrol" class="h2">Бензинові двигуни</h2>
        <div class="group"><EngineRow v-for="e in petrol" :key="e.id" :e="e" /></div>
      </section>
      <section id="sec-diesel" class="anchor" aria-labelledby="h-diesel">
        <h2 id="h-diesel" class="h2">Дизельні двигуни</h2>
        <div class="group"><EngineRow v-for="e in diesel" :key="e.id" :e="e" /></div>
      </section>
      <section id="sec-gears" class="anchor" aria-labelledby="h-gears">
        <h2 id="h-gears" class="h2">Коробки передач</h2>
        <div class="group">
          <details v-for="g in gearboxes" :key="g.id" class="acc">
            <summary><span class="grow">{{ g.name }}<span class="engine-meta"><DotsRating :r="g.reliability" /><span>{{ g.reliability }} з 5</span></span></span><AppIcon name="chevDown" cls="turn" /></summary>
            <div class="acc-body">{{ g.summary }}</div>
            <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x" />
          </details>
        </div>
      </section>
      <section id="sec-bodies" class="anchor" aria-labelledby="h-bodies">
        <h2 id="h-bodies" class="h2">Кузови</h2>
        <div class="group"><div v-for="b in bodies" :key="b.id" class="row-block"><h3 class="row-t">{{ b.name }} <span class="muted" style="font-weight: 450">{{ b.years[0] }}–{{ b.years[1] }}</span></h3><p class="issue-d">{{ b.note }}</p></div></div>
      </section>
      <section id="sec-trims" class="anchor" aria-labelledby="h-trims">
        <h2 id="h-trims" class="h2">Комплектації</h2>
        <div class="group"><div v-for="t in trims" :key="t.name" class="row-block"><h3 class="row-t">{{ t.name }}</h3><p class="issue-d">{{ t.note }}</p></div></div>
      </section>
      <CommonBlock />
      <VinBlock />
      <KitBlock />
      <p class="foot center" style="margin-top: var(--s5)">Ціни орієнтовні, за даними auto.ria ({{ M.updated }}).</p>
    </div>
  </AppScreen>
</template>
