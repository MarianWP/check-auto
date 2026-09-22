<script setup>
/* Текст відповіді помічника з ефектом набору: поки відповідь стрімиться (live), показаний текст плавно
   наздоганяє отриманий по кілька символів на кадр; щойно стрім завершено, показуємо все одразу. */
import { ref, watch, onBeforeUnmount } from "vue";

const props = defineProps({ text: { type: String, default: "" }, live: { type: Boolean, default: false } });
const shown = ref(props.live ? 0 : props.text.length);
let raf = 0;
function tick() {
  raf = 0;
  const total = props.text.length;
  if (shown.value >= total) return;
  shown.value = Math.min(total, shown.value + Math.max(1, Math.ceil((total - shown.value) / 14)));
  if (shown.value < total) raf = requestAnimationFrame(tick);
}
watch(() => [props.text, props.live], () => {
  if (!props.live) { shown.value = props.text.length; if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
  if (!raf) raf = requestAnimationFrame(tick);
});
onBeforeUnmount(() => { if (raf) cancelAnimationFrame(raf); });
</script>

<template>
  <span class="ai-text" :class="{ live }">{{ text.slice(0, shown) }}<span v-if="live && shown < text.length" class="ai-caret" aria-hidden="true"></span></span>
</template>
