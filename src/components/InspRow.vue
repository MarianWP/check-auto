<script setup>
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import G from "../data/golf";
import { computeReport, dateStr, VERDICTS } from "../store";
import { go } from "../nav";
import { menu } from "../actions";

const props = defineProps({ i: { type: Object, required: true } });
const rep = computed(() => computeReport(props.i));
const to = computed(() => props.i.done ? "/report/" + props.i.id : "/check/" + props.i.id + "/" + (props.i.stage || 0));
const title = computed(() => props.i.name || G.label(props.i.cfg));
const sub = computed(() => (props.i.name ? G.label(props.i.cfg) + " · " : "") + dateStr(props.i.createdAt));
</script>

<template>
  <div class="insp-wrap">
    <button class="insp" data-action="go" :data-to="to" @click="go(to)">
      <div class="insp-main">
        <div class="insp-t">{{ title }}</div>
        <div class="insp-s">{{ sub }}</div>
        <div v-if="!i.done" class="progress"><i :style="{ transform: 'scaleX(' + (rep.answeredAll / rep.total).toFixed(3) + ')' }"></i></div>
      </div>
      <span v-if="i.done" class="badge" :class="'badge-' + rep.verdict">{{ VERDICTS[rep.verdict].short }}</span>
      <span v-else class="badge badge-progress num">{{ rep.answeredAll }}/{{ rep.total }}</span>
    </button>
    <button class="more" data-action="menu" :data-id="i.id" aria-label="Дії" @click="menu(i.id)"><AppIcon name="more" /></button>
  </div>
</template>
