<script setup>
/* Попередження для моделей-чернеток: дані ще не перевірені людиною, яка знає авто. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { modelDef } from "../data/index.js";

const props = defineProps({ model: { type: String, required: true } });
const m = computed(() => modelDef(props.model));
</script>

<template>
  <div v-if="m && m.draft" class="notice warn" data-notice="draft" role="status">
    <AppIcon name="alert" />
    <div><b>{{ m.name }}: дані ще чернетка</b>Двигуни взято зі спільної бібліотеки VAG, а ціни, роки й хвороби кузова потребують перевірки. Чек-лист працює повністю.</div>
  </div>
</template>
