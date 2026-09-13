<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { switchTab } from "../nav";

const route = useRoute();
const tabs = [
  { id: "home", to: "/", label: "Перевірки", icon: "clipboard" },
  { id: "new", to: "/new", label: "Нова", icon: "circlePlus" },
  { id: "guide", to: "/guide", label: "Довідник", icon: "book" }
];
const active = computed(() => route.meta.tab);
</script>

<template>
  <nav id="tabs" class="tabs" aria-label="Розділи">
    <div class="tabs-in">
      <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: active === t.id }" :data-tab="t.id" :data-to="t.to" :aria-current="active === t.id ? 'page' : null" @click="switchTab(t.to)">
        <AppIcon :name="t.icon" /><span>{{ t.label }}</span>
      </button>
    </div>
  </nav>
</template>
