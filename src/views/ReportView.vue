<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import ScoreRing from "../components/ScoreRing.vue";
import PriceBlock from "../components/PriceBlock.vue";
import G from "../data/golf";
import { insp, computeReport, VERDICTS, money, fmtN, costStr, dateStr } from "../store";
import { go } from "../nav";
import { share, confirmDelete } from "../actions";

const route = useRoute();
const i = insp(String(route.params.id));
const rep = computed(() => computeReport(i));
const price = G.priceFor(i.cfg);
const label = G.label(i.cfg);
const V = computed(() => VERDICTS[rep.value.verdict]);
const rest = computed(() => rep.value.skipped.concat(rep.value.unanswered));
const groups = [["crit", "Критичні проблеми"], ["major", "Важливі зауваження"], ["minor", "Дрібниці"]];
const fair = computed(() => {
  const r = rep.value;
  if (!i.price) return "";
  return " Від ціни " + money(i.price) + " справедливо просити " + money(Math.max(0, i.price - r.cost.hi)) + "–" + fmtN(Math.max(0, i.price - r.cost.lo)) + ".";
});
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/" back-label="Перевірки" title="Звіт" />
    <div class="content" :class="enter">
      <div class="model-head"><div class="kicker">{{ i.name || 'Golf V' }}</div><h1>{{ label }}</h1><p class="sub">{{ dateStr(i.updatedAt) }}</p></div>
      <div class="verdict" :class="rep.verdict" style="margin-top:12px">
        <ScoreRing :score="rep.score" />
        <div><div class="verdict-t">{{ V.t }}</div><div class="verdict-s">{{ V.s(rep) }}</div></div>
      </div>
      <div class="stats">
        <div class="stat ok"><b>{{ rep.ok }}</b><span>ок</span></div>
        <div class="stat bad"><b>{{ rep.failCount }}</b><span>проблем</span></div>
        <div class="stat"><b>{{ rep.skipped.length + rep.unanswered.length }}</b><span>не перевірено</span></div>
      </div>
      <template v-if="rep.cost.hi > 0">
        <h2 class="section-h">Бюджет на усунення</h2>
        <div class="group"><div class="price-card"><div class="price-big num">≈ {{ costStr([rep.cost.lo, rep.cost.hi]) }}</div><p class="sub" style="margin-top:6px">Сума орієнтовних вартостей по знайдених проблемах. Це твій аргумент у торгу.{{ fair }}</p></div></div>
      </template>
      <PriceBlock :i="i" :price="price" />
      <template v-for="[k, title] in groups" :key="k">
        <template v-if="rep.fails[k].length">
          <h2 class="section-h">{{ title }} · {{ rep.fails[k].length }}</h2>
          <div class="group">
            <div v-for="f in rep.fails[k]" :key="f.it.id" class="rep-item">
              <div class="t">{{ f.it.t }}</div>
              <div v-if="f.a.tags && f.a.tags.length" class="tagline"><span v-for="t in f.a.tags" :key="t">{{ t }}</span></div>
              <div v-if="f.a.c" class="c">{{ f.a.c }}</div>
              <div class="m">{{ f.stage.short }}<template v-if="f.it.cost && f.it.cost[1]"> · ≈ {{ costStr(f.it.cost) }}</template></div>
            </div>
          </div>
        </template>
      </template>
      <template v-if="!rep.failCount"><h2 class="section-h">Проблеми</h2><div class="group"><div class="row-block sub">Проблем не зафіксовано. Якщо огляд був повним — це дуже добрий знак.</div></div></template>
      <template v-if="rest.length">
        <h2 class="section-h">Не перевірено · {{ rest.length }}</h2>
        <div class="group"><details class="acc"><summary><span>Показати список</span><AppIcon name="chev" cls="chev" /></summary><div class="acc-body"><ul class="list"><li v-for="x in rest" :key="x.it.id">{{ x.it.t }} <span class="muted">· {{ x.stage.short }}</span></li></ul></div></details></div>
      </template>
      <div class="btn-stack" style="margin-top:24px">
        <button class="btn" data-action="share" :data-id="i.id" @click="share(i.id)"><AppIcon name="share" /><span>Поділитися звітом</span></button>
        <button class="btn secondary" data-action="go" :data-to="'/check/' + i.id + '/0'" @click="go('/check/' + i.id + '/0')">Повернутись до чек-листа</button>
        <button class="btn ghost danger" data-action="delete" :data-id="i.id" @click="confirmDelete(i.id)">Видалити перевірку</button>
      </div>
      <p class="foot" style="text-align:center;margin-top:16px">Звіт — орієнтир, а не експертиза. Для остаточного рішення покажи авто на СТО.</p>
    </div>
  </AppScreen>
</template>
