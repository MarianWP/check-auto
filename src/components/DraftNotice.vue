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
    <div><b>{{ m.brand }} {{ m.name }}: картку склав ШІ</b>Хвороби, ціни й регламенти взято із загальних даних про цю модель, тож перевіряй критичне на СТО і торгуйся за фактом. Чек-лист працює повністю.</div>
  </div>
  <div v-else-if="m && m.draft" class="notice warn" data-notice="draft" role="status">
    <AppIcon name="alert" />
    <div><b>{{ m.name }}: дані ще чернетка</b>Двигуни взято зі спільної бібліотеки VAG, а ціни, роки й хвороби кузова потребують перевірки. Чек-лист працює повністю.</div>
  </div>
</template>
