<script setup>
/* Верхня смуга. root — лише суцільна смуга під статус-бар і кнопки Telegram (заголовок живе в контенті);
   інакше рядок із «Назад» і короткою назвою екрана. Якщо на екрані є власний великий заголовок (h1 у .page-head),
   назва у смузі ховається і з'являється лише коли той заголовок поїхав за край при скролі: без дубля. */
import { computed, inject, reactive, ref, onMounted, onBeforeUnmount } from "vue";
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

const el = ref(null);
const dup = ref(false), passed = ref(false);
let io = null;
onMounted(() => {
  const screen = el.value && el.value.closest(".screen");
  const h1 = screen && screen.querySelector(".page-head h1");
  if (!h1 || !("IntersectionObserver" in window)) return;
  dup.value = true;
  const top = el.value.getBoundingClientRect().height;
  io = new IntersectionObserver(entries => { passed.value = !entries[0].isIntersecting; }, { root: screen, rootMargin: "-" + Math.round(top) + "px 0px 0px 0px", threshold: 0 });
  io.observe(h1);
});
onBeforeUnmount(() => { if (io) io.disconnect(); });
</script>

<template>
  <header id="nav" ref="el" class="topbar" :class="{ root, scrolled: s.scrolled }">
    <div v-if="!root" class="topbar-row" :class="{ 'no-back': !showBack }">
      <button v-if="showBack" class="icon-btn" data-action="back" :data-to="back" :aria-label="backLabel ? 'Назад: ' + backLabel : 'Назад'" @click="goBack(back)">
        <AppIcon name="arrowLeft" />
      </button>
      <div class="topbar-title" :class="{ dup, passed }" :aria-hidden="dup && !passed ? 'true' : null">{{ title }}</div>
      <slot name="right"></slot>
    </div>
    <slot name="extra"></slot>
  </header>
</template>
