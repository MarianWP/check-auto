<script setup>
import { computed } from "vue";
import ICONS from "../icons";

const props = defineProps({ name: { type: String, required: true }, cls: { type: String, default: "" } });
const path = computed(() => ICONS[props.name] || "");
</script>

<template>
  <svg class="i" :class="cls" viewBox="0 0 24 24" aria-hidden="true" v-html="path"></svg>
</template>
