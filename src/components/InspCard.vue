<script setup>
/* Картка огляду на головній: авто, конфігурація, дата, прогрес і одна зрозуміла дія. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import StageStrip from "./StageStrip.vue";
import CfgLabel from "./CfgLabel.vue";
import { computeReport, visibleStages, stageProgress, dateStr, clamp, VERDICTS, apiOf } from "../store";
import { go } from "../nav";
import { menu } from "../actions";

const props = defineProps({
  i: { type: Object, required: true },
  featured: { type: Boolean, default: false }
});
const G = apiOf(props.i);
const rep = computed(() => computeReport(props.i));
const stages = computed(() => rep.value.stages);
const prog = computed(() => stageProgress(props.i, stages.value));
const stageIdx = computed(() => clamp(props.i.stage || 0, 0, stages.value.length - 1));
const pct = computed(() => rep.value.pct);
const engine = computed(() => G.engine(props.i.cfg.engine));
const title = computed(() => props.i.name || engine.value.name + " · " + props.i.cfg.year);
const to = computed(() => props.i.done ? "/report/" + props.i.id : "/check/" + props.i.id + "/" + stageIdx.value);
const V = computed(() => VERDICTS[rep.value.verdict]);
</script>

<template>
  <article class="insp-card" :class="{ featured }" :data-id="i.id">
    <header class="insp-head">
      <div class="insp-titles">
        <h3 class="insp-title">{{ title }}</h3>
        <p class="insp-cfg"><CfgLabel :cfg="i.cfg" :model="G.id" :mode="i.name ? 'short' : 'rest'" /></p>
        <p class="insp-date">{{ i.done ? 'Завершено' : 'Розпочато' }} {{ dateStr(i.done ? i.updatedAt : i.createdAt) }}</p>
      </div>
      <button class="icon-btn" data-action="menu" :data-id="i.id" :aria-label="'Дії з оглядом «' + title + '»'" @click="menu(i.id)"><AppIcon name="more" /></button>
    </header>

    <template v-if="!i.done">
      <div class="metrics">
        <div class="metric"><b class="metric-v num">{{ pct }}<span class="unit"> %</span></b><span class="metric-l">перевірено</span></div>
        <div class="metric"><b class="metric-v num">{{ stageIdx + 1 }}<span class="unit"> з {{ stages.length }}</span></b><span class="metric-l">етап: {{ stages[stageIdx].short }}</span></div>
      </div>
      <StageStrip :prog="prog" :current="stageIdx" />
      <p class="insp-count">Перевірено {{ rep.answered }} з {{ rep.total }} пунктів · пропущено {{ rep.skipped.length }}<template v-if="rep.failCount"> · проблем: {{ rep.failCount }}</template></p>
      <button class="btn" :class="{ tonal: !featured }" data-action="continue" :data-to="to" @click="go(to)"><span>Продовжити</span><AppIcon name="arrowRight" /></button>
    </template>

    <template v-else>
      <div class="insp-result">
        <span class="badge" :class="'v-' + rep.verdict"><AppIcon :name="V.icon" />{{ V.short }}</span>
        <span class="insp-score num">оцінка {{ rep.score }} · перевірено {{ rep.pct }} %</span>
      </div>
      <StageStrip :prog="prog" />
      <button class="btn tonal" data-action="report" :data-to="to" @click="go(to)"><span>Відкрити звіт</span><AppIcon name="arrowRight" /></button>
    </template>
  </article>
</template>
