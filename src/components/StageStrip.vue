<script setup>
/* Смужка етапів: один сегмент = один етап огляду, заливка = частка пройдених пунктів етапу. */
import { computed } from "vue";

const props = defineProps({
  prog: { type: Array, required: true },
  current: { type: Number, default: -1 }
});
const doneCount = computed(() => props.prog.filter(p => p.total && p.answered >= p.total).length);
const fill = p => (p.total ? Math.min(1, p.answered / p.total) : 0).toFixed(3);
</script>

<template>
  <div class="segbar" role="img" :aria-label="'Завершено етапів: ' + doneCount + ' з ' + prog.length">
    <i v-for="(p, k) in prog" :key="k" :class="{ cur: k === current }"><b :style="{ '--f': fill(p) }"></b></i>
  </div>
</template>
