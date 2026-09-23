<script setup>
import { computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import BottomNav from "./components/BottomNav.vue";
import SheetHost from "./components/SheetHost.vue";
import ToastHost from "./components/ToastHost.vue";
import LightboxHost from "./components/LightboxHost.vue";
import { ui, account, insp } from "./store";

const route = useRoute();
const router = useRouter();
const available = computed(() => !["car", "check", "report"].includes(route.name) || !!insp(String(route.params.id)));
watch(available, value => { if (!value) router.replace("/"); });
</script>

<template>
  <!-- Поки відкрито аркуш або фото, решта інтерфейсу неактивна для фокуса й читачів екрана. -->
  <div class="shell" :inert="!!ui.sheet || !!ui.lightbox">
    <router-view v-if="available" :key="account.epoch + route.fullPath" />
    <ToastHost />
    <BottomNav v-if="route.meta.tab" />
  </div>
  <SheetHost />
  <LightboxHost />
</template>
