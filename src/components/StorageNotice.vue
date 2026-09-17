<script setup>
/* Попередження про сховище: зміни не зберігаються або частину збережених даних не вдалося прочитати. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { storage, dismissLoadNotice } from "../store";

const loadText = computed(() => {
  if (storage.loadError) return "Збережені дані пошкоджені й не відкрилися.";
  return "Пропущено пошкоджених записів: " + storage.rejected + ".";
});
</script>

<template>
  <div v-if="!storage.ok" class="notice bad" data-notice="save" role="alert">
    <AppIcon name="alert" />
    <div><b>Зміни не зберігаються</b><br>Браузер не дає записати дані: приватний режим або немає місця. Зроби резервну копію нижче, інакше огляд зникне після закриття апки.</div>
  </div>
  <div v-else-if="storage.loadError || storage.rejected" class="notice warn" data-notice="load" role="status">
    <AppIcon name="alert" />
    <div><b>Частину даних не вдалося прочитати</b><br>{{ loadText }} Оригінал відкладено окремо, нове збереження його не затре.</div>
    <button class="x" aria-label="Сховати" @click="dismissLoadNotice()"><AppIcon name="x" cls="sm" /></button>
  </div>
</template>
