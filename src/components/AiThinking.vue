<script setup>
/* Стан «ШІ думає»: контур, що малюється по колу (stroke-dashoffset), і текст із мерехтінням.
   Довжина контуру береться з самого шляху, тому анімація не залежить від розміру. Reduced motion: без руху. */
import { ref, onMounted } from "vue";

defineProps({ text: { type: String, default: "Думаю…" }, size: { type: Number, default: 22 } });
const path = ref(null);
const len = ref(0);
onMounted(() => { try { len.value = Math.ceil(path.value.getTotalLength()); } catch (e) { len.value = 60; } });
</script>

<template>
  <span class="ai-think" role="status" aria-live="polite">
    <svg class="ai-loader" :width="size" :height="size" viewBox="0 0 19 19" fill="none" aria-hidden="true">
      <path ref="path" d="M4.43431 2.42415C-0.789139 6.90104 1.21472 15.2022 8.434 15.9242C15.5762 16.6384 18.8649 9.23035 15.9332 4.5183C14.1316 1.62255 8.43695 0.0528911 7.51841 3.33733C6.48107 7.04659 15.2699 15.0195 17.4343 16.9241"
        stroke="currentColor" stroke-width="2.2" stroke-linecap="round" :class="{ ready: len > 0 }" :style="len ? { strokeDasharray: len, '--path-length': len } : null" />
    </svg>
    <span class="ai-shimmer">{{ text }}</span>
  </span>
</template>
