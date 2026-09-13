<script setup>
/* Екран — єдиний скролер застосунку. Слот отримує клас анімації входу (ставиться лише на .content),
   шапка отримує стан скролу через inject. Скролер сам ніколи не анімується. */
import { reactive, ref, provide, onMounted } from "vue";
import { useRoute } from "vue-router";
import { nav } from "../nav";

const route = useRoute();
const el = ref(null);
const state = reactive({ scrolled: false, titled: false });
provide("scrollState", state);

const dir = nav.dir;
const enter = dir === "back" ? "enter-back" : dir === "tab" ? "enter-tab" : dir === "fwd" ? "enter-fwd" : "";
const hasBar = !!route.meta.bar;
const hasTabs = !hasBar && !!route.meta.tab;

function onScroll() {
  const s = el.value; if (!s) return;
  state.scrolled = s.scrollTop > 4;
  state.titled = s.scrollTop > 44;
}
onMounted(() => {
  const y = dir === "back" ? nav.scroll[route.fullPath] : 0;
  if (y && el.value) el.value.scrollTop = y;
  onScroll();
});
</script>

<template>
  <div ref="el" class="screen" :class="{ 'has-bar': hasBar, 'has-tabs': hasTabs }" @scroll.passive="onScroll">
    <slot :enter="enter"></slot>
  </div>
</template>
