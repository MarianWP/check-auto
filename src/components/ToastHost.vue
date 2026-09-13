<script setup>
import { useRoute } from "vue-router";
import { ui } from "../store";

const route = useRoute();
</script>

<template>
  <transition name="toast">
    <div v-if="ui.toast" :key="ui.toast.id" class="toast" :class="{ 'above-bar': route.meta.bar, 'above-tabs': !route.meta.bar && route.meta.tab }" role="status">{{ ui.toast.msg }}</div>
  </transition>
</template>
