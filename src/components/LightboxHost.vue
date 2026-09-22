<script setup>
/* Перегляд фото на весь екран. Esc або тап поза фото закриває, фокус повертається назад. */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import AppIcon from "./AppIcon.vue";
import { ui, closeLightbox } from "../store";

const closeBtn = ref(null);
let opener = null;
function onKey(e) { if (e.key === "Escape" && ui.lightbox) { e.preventDefault(); closeLightbox(); } }
onMounted(() => document.addEventListener("keydown", onKey));
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
watch(() => ui.lightbox, (v, prev) => {
  if (v && !prev) { opener = document.activeElement; nextTick(() => closeBtn.value && closeBtn.value.focus({ preventScroll: true })); }
  else if (!v && prev && opener && opener.isConnected) { const b = opener; opener = null; setTimeout(() => b.focus({ preventScroll: true }), 60); }
});
</script>

<template>
  <transition name="scrim">
    <div v-if="ui.lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Перегляд фото" @click.self="closeLightbox()">
      <button ref="closeBtn" class="icon-btn tonal lightbox-close" aria-label="Закрити" @click="closeLightbox()"><AppIcon name="x" /></button>
      <img :src="ui.lightbox.url" :alt="ui.lightbox.caption || 'Фото'">
      <p v-if="ui.lightbox.caption" class="lightbox-cap">{{ ui.lightbox.caption }}</p>
    </div>
  </transition>
</template>
