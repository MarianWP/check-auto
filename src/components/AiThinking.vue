<script setup>
/* Стан «ШІ думає»: та сама іконка помічника з пульсом кольору і текст, по якому лінійно біжить вузька світла смуга
   (ширина смуги залежить від довжини тексту, як у референсі TextShimmer). Reduced motion: без руху. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";

const props = defineProps({ text: { type: String, default: "Думаю…" }, spread: { type: Number, default: 2 } });
const style = computed(() => ({ "--spread": props.text.length * props.spread + "px" }));
</script>

<template>
  <span class="ai-think" role="status" aria-live="polite">
    <span class="ai-pulse" aria-hidden="true"><AppIcon name="sparkles" /></span>
    <span class="ai-shimmer" :style="style">{{ text }}</span>
  </span>
</template>
