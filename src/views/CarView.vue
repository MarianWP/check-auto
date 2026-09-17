<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import SpecTiles from "../components/SpecTiles.vue";
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
    <NavBar back="/" back-label="мої огляди" title="Картка авто" />
    <div class="content" :class="enter">
      <header class="page-head">
        <p class="kicker">Volkswagen Golf V<template v-if="i.name"> · {{ i.name }}</template></p>
        <h1 class="title">{{ e.name }} · {{ i.cfg.year }}</h1>
        <p class="lead">{{ b.name }} · {{ g.name }}</p>
      </header>
      <SpecTiles :e="e" style="margin-top: var(--s4)" />
      <PriceBlock :i="i" :price="price" />
      <EngineBlock :e="e" />
      <GearBlock :g="g" />
      <section aria-labelledby="h-body">
        <h2 id="h-body" class="h2">Кузов: {{ b.name }}</h2>
        <div class="card"><p class="prose">{{ b.note }}</p></div>
      </section>
      <CommonBlock />
      <KitBlock />
    </div>
  </AppScreen>

  <div id="bar" class="bar">
    <div class="bar-in">
      <p class="bar-status">
        <span>{{ rep.answeredAll ? 'Пройдено пунктів' : 'Чек-лист для цієї конфігурації' }}</span>
        <b>{{ rep.answeredAll ? rep.answeredAll + ' з ' + rep.total : rep.total + ' пунктів' }}</b>
      </p>
      <button class="btn" data-action="go" :data-to="checkTo" @click="go(checkTo)"><span>{{ rep.answeredAll ? 'Продовжити огляд' : 'Почати огляд' }}</span><AppIcon name="arrowRight" /></button>
    </div>
  </div>
</template>
