<script setup>
import { useRoute } from "vue-router";
import BottomNav from "./components/BottomNav.vue";
import SheetHost from "./components/SheetHost.vue";
import ToastHost from "./components/ToastHost.vue";
import { ui } from "./store";

const route = useRoute();
</script>

<template>
  <!-- Поки відкрито аркуш, решта інтерфейсу неактивна для фокуса й читачів екрана. -->
  <div class="shell" :inert="!!ui.sheet">
    <router-view :key="route.fullPath" />
    <ToastHost />
    <BottomNav v-if="route.meta.tab" />
  </div>
  <SheetHost />
</template>
