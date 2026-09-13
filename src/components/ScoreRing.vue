<script setup>
import { computed } from "vue";

const props = defineProps({ score: { type: Number, required: true } });
const CIRC = 2 * Math.PI * 36;
const dash = CIRC.toFixed(1);
const off = computed(() => (CIRC * (1 - props.score / 100)).toFixed(1));
</script>

<template>
  <div class="ring" role="img" :aria-label="'Оцінка ' + score + ' зі 100'">
    <svg viewBox="0 0 84 84"><circle class="bgc" cx="42" cy="42" r="36" /><circle class="fgc" cx="42" cy="42" r="36" :style="{ strokeDasharray: dash, '--off': off }" /></svg>
    <div class="val">{{ score }}</div>
  </div>
</template>
