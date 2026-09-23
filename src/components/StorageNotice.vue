<script setup>
/* Попередження про сховище: зміни не зберігаються або частину збережених даних не вдалося прочитати. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { storage, db, dismissLoadNotice } from "../store";

const loadText = computed(() => {
  if (storage.loadError) return "Збережені дані пошкоджені й не відкрилися.";
  return "Пропущено пошкоджених записів: " + storage.rejected + ".";
});
</script>

<template>
  <div v-if="db.pendingInspections.length" class="notice warn" role="status"><AppIcon name="alert" /><div><b>Очікують дані моделі: {{ db.pendingInspections.length }}</b>Відповіді збережено. Увійди у свій акаунт і синхронізуй дані або імпортуй резервну копію з моделями.</div></div>
  <div v-if="!storage.ok" class="notice bad" data-notice="save" role="alert">
    <AppIcon name="alert" />
    <div><b>Зміни не зберігаються</b>Браузер не дає записати дані: приватний режим або немає місця. Зроби резервну копію нижче, інакше огляд зникне після закриття застосунку.</div>
  </div>
  <div v-else-if="storage.loadError || storage.rejected" class="notice warn" data-notice="load" role="status">
    <AppIcon name="alert" />
    <div><b>Частину даних не вдалося прочитати</b>{{ loadText }} Оригінал відкладено окремо, нове збереження його не затре.</div>
    <button class="icon-btn" aria-label="Сховати повідомлення" @click="dismissLoadNotice()"><AppIcon name="x" /></button>
  </div>
</template>
