<script setup>
/* Верхня смуга. root — лише суцільна смуга під статус-бар і кнопки Telegram (заголовок живе в контенті);
   інакше рядок із «Назад» і короткою назвою екрана. */
import { computed, inject, reactive } from "vue";
import AppIcon from "./AppIcon.vue";
import { back as goBack } from "../nav";
import { tgState } from "../tg";

const props = defineProps({
  root: { type: Boolean, default: false },
  back: { type: String, default: "" },
  backLabel: { type: String, default: "" },
  title: { type: String, default: "" }
});
const s = inject("scrollState", reactive({ scrolled: false }));
/* У Telegram «Назад» показує сам Telegram (BackButton), тож власну кнопку ховаємо, щоб їх не було дві. */
const showBack = computed(() => !!props.back && !tgState.nativeBack);
</script>

<template>
  <header id="nav" class="topbar" :class="{ root, scrolled: s.scrolled }">
    <div v-if="!root" class="topbar-row" :class="{ 'no-back': !showBack }">
      <button v-if="showBack" class="icon-btn" data-action="back" :data-to="back" :aria-label="backLabel ? 'Назад: ' + backLabel : 'Назад'" @click="goBack(back)">
        <AppIcon name="arrowLeft" />
      </button>
      <div class="topbar-title">{{ title }}</div>
      <slot name="right"></slot>
    </div>
    <slot name="extra"></slot>
  </header>
</template>
