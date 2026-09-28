<script setup>
/* Попередження для моделей-чернеток і карток, які склав ШІ: дані не перевірені людиною, яка знає це авто. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { modelDef } from "../data/index.js";

const props = defineProps({ model: { type: String, required: true } });
const m = computed(() => modelDef(props.model));
</script>

<template>
  <div v-if="m && m.ai" class="notice warn" data-notice="ai" role="status">
    <AppIcon name="sparkles" />
    <div><b>Картку склав ШІ</b>Дані орієнтовні: критичне перевіряй на СТО.</div>
  </div>
  <div v-else-if="m && m.draft" class="notice warn" data-notice="draft" role="status">
    <AppIcon name="alert" />
    <div><b>Дані ще чернетка</b>Ціни, роки й хвороби кузова можуть бути неточні.</div>
  </div>
</template>
