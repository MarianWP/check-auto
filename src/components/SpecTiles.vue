<script setup>
/* Чотири головні показники двигуна великими плитками: потужність, надійність, привід ГРМ, придатність до ГБО. */
import { computed } from "vue";

const props = defineProps({ e: { type: Object, required: true } });
const timing = computed(() => ({ chain: "Ланцюг", belt: "Ремінь", gears: "Шестерні" })[props.e.timing.type] || "ГРМ");
const lpg = computed(() => ({ ok: "Підходить", hard: "Ризиковано", no: "Не ставити" })[props.e.lpg]);
</script>

<template>
  <div class="tiles" aria-label="Головні показники двигуна" role="group">
    <div class="tile"><b class="tile-v">{{ e.hp }}</b><span class="tile-l">Потужність</span></div>
    <div class="tile"><b class="tile-v big">{{ e.reliability }}<span class="unit"> з 5</span></b><span class="tile-l">Надійність двигуна</span></div>
    <div class="tile"><b class="tile-v">{{ timing }}</b><span class="tile-l">Привід ГРМ</span></div>
    <div class="tile"><b class="tile-v">{{ lpg }}</b><span class="tile-l">ГБО</span></div>
  </div>
</template>
