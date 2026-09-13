<script setup>
import { inject, reactive } from "vue";
import AppIcon from "./AppIcon.vue";
import { back as goBack } from "../nav";

defineProps({
  back: { type: String, default: "" },
  backLabel: { type: String, default: "" },
  title: { type: String, default: "" },
  sub: { type: String, default: "" },
  titleOnScroll: { type: Boolean, default: false }
});
const s = inject("scrollState", reactive({ scrolled: false, titled: false }));
</script>

<template>
  <header id="nav" class="nav" :class="{ scrolled: s.scrolled, titled: s.titled }">
    <div class="nav-row">
      <div>
        <button v-if="back" class="nav-btn" data-action="back" :data-to="back" aria-label="Назад" @click="goBack(back)">
          <AppIcon name="back" /><span>{{ backLabel || 'Назад' }}</span>
        </button>
      </div>
      <div class="nav-title" :class="{ stacked: !!sub, 'on-scroll': titleOnScroll }">{{ title }}<span v-if="sub" class="nav-sub">{{ sub }}</span></div>
      <div><slot name="right"></slot></div>
    </div>
    <slot name="extra"></slot>
  </header>
</template>
