<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import PriceBlock from "../components/PriceBlock.vue";
import EngineBlock from "../components/EngineBlock.vue";
import GearBlock from "../components/GearBlock.vue";
import CommonBlock from "../components/CommonBlock.vue";
import KitBlock from "../components/KitBlock.vue";
import G from "../data/golf";
import { insp, computeReport } from "../store";
import { go } from "../nav";

const route = useRoute();
const i = insp(String(route.params.id));
const e = G.engine(i.cfg.engine), b = G.body(i.cfg.body), g = G.gearbox(i.cfg.gear), price = G.priceFor(i.cfg);
const rep = computed(() => computeReport(i));
const checkTo = computed(() => "/check/" + i.id + "/" + (i.stage || 0));
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/" title="Картка моделі" />
    <div class="content" :class="enter">
      <div class="model-head">
        <div class="kicker">Volkswagen Golf V</div>
        <h1>{{ e.name }} · {{ i.cfg.year }}</h1>
        <p class="sub">{{ b.name }} · {{ g.name }}<template v-if="i.name"> · {{ i.name }}</template></p>
      </div>
      <PriceBlock :i="i" :price="price" />
      <EngineBlock :e="e" />
      <GearBlock :g="g" />
      <h2 class="section-h">Кузов: {{ b.name }}</h2>
      <div class="group"><div class="row-block sub">{{ b.note }}</div></div>
      <CommonBlock />
      <KitBlock />
    </div>
  </AppScreen>
  <div id="bar" class="bar">
    <div class="bar-in">
      <button class="btn" data-action="go" :data-to="checkTo" @click="go(checkTo)"><span>{{ rep.answeredAll ? 'Продовжити огляд' : 'Почати огляд' }}</span><AppIcon name="chev" /></button>
    </div>
  </div>
</template>
