<script setup>
import { useRoute } from "vue-router";
import TabBar from "./components/TabBar.vue";
import SheetHost from "./components/SheetHost.vue";
import ToastHost from "./components/ToastHost.vue";

const route = useRoute();
</script>

<template>
  <router-view :key="route.fullPath" />
  <TabBar v-if="route.meta.tab" />
  <SheetHost />
  <ToastHost />
</template>
