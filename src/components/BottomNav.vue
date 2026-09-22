<script setup>
/* Нижня навігація: округла панель розділів + окрема оранжева кнопка створення огляду.
   Посилання — справжні <a href>, перемикання не пише історію (див. nav.js). */
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { switchTab } from "../nav";

const route = useRoute();
const tabs = [
  { id: "home", to: "/", label: "Огляди", icon: "clipboard" },
  { id: "guide", to: "/guide", label: "Довідник", icon: "book" },
  { id: "assistant", to: "/assistant", label: "Помічник", icon: "sparkles" }
];
const active = computed(() => route.meta.tab);
</script>

<template>
  <nav id="tabs" class="bottom-nav" aria-label="Головна навігація">
    <div class="bottom-nav-in">
      <div class="tabs">
        <a v-for="t in tabs" :key="t.id" class="tab" :class="{ on: active === t.id }" :href="'#' + t.to" draggable="false" :data-tab="t.id" :aria-current="active === t.id ? 'page' : null" @click.prevent="switchTab(t.to)">
          <AppIcon :name="t.icon" /><span>{{ t.label }}</span>
        </a>
      </div>
      <a class="fab" :class="{ on: active === 'new' }" href="#/new" draggable="false" data-tab="new" aria-label="Новий огляд" :aria-current="active === 'new' ? 'page' : null" @click.prevent="switchTab('/new')">
        <AppIcon name="plus" />
      </a>
    </div>
  </nav>
</template>
