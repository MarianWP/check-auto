<script setup>
/* Верхня смуга. root — лише суцільна смуга під статус-бар і кнопки Telegram (заголовок живе в контенті).
   На вкладених екранах заголовок сторінки стоїть у самій смузі поруч зі стрілкою «Назад» (h1), а підпис (kicker)
   і пояснення (lead) ідуть одразу під смугою як частина шапки: жодного дубля і жодної порожньої плашки.
   При скролі смуга лишається зверху, а заголовок трохи меншає. */
import { computed, inject, reactive } from "vue";
import AppIcon from "./AppIcon.vue";
import { back as goBack } from "../nav";
import { tgState } from "../tg";

const props = defineProps({
  root: { type: Boolean, default: false },
  back: { type: String, default: "" },
  backLabel: { type: String, default: "" },
  title: { type: String, default: "" },
  kicker: { type: String, default: "" },
  lead: { type: String, default: "" },
  /* h1 за замовчуванням; "div", коли справжній заголовок сторінки живе в контенті (чек-лист). */
  titleTag: { type: String, default: "h1" }
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
      <component :is="titleTag" class="topbar-title"><slot name="title">{{ title }}</slot></component>
      <slot name="right"></slot>
    </div>
    <slot name="extra"></slot>
  </header>
  <div v-if="!root && (kicker || lead || $slots.sub)" class="head-sub">
    <p v-if="kicker" class="kicker">{{ kicker }}</p>
    <slot name="sub"></slot>
    <p v-if="lead" class="lead">{{ lead }}</p>
  </div>
</template>
