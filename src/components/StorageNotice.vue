<script setup>
/* Попередження про сховище: зміни не зберігаються або частину збережених даних не вдалося прочитати. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { storage, db, dismissLoadNotice } from "../store";
import { exportBackup } from "../backup";

const loadText = computed(() => {
  if (storage.loadError) return "Збережені дані не відкрилися.";
  return "Пропущено записів: " + storage.rejected + ".";
});
</script>

<template>
  <div v-if="db.pendingInspections.length" class="notice warn" role="status"><AppIcon name="alert" /><div><b>Очікують дані моделі: {{ db.pendingInspections.length }}</b>Увійди в акаунт або віднови копію з моделями.</div></div>
  <div v-if="!storage.ok" class="notice bad" data-notice="save" role="alert">
    <AppIcon name="alert" />
    <div><b>Зміни не зберігаються</b>Приватний режим або немає місця. Збережи копію, інакше дані зникнуть.<button class="link" data-action="backup-export" @click="exportBackup()">Зберегти копію</button></div>
  </div>
  <div v-else-if="storage.loadError || storage.rejected" class="notice warn" data-notice="load" role="status">
    <AppIcon name="alert" />
    <div><b>Частину даних не прочитано</b>{{ loadText }} Оригінал збережено окремо.</div>
    <button class="icon-btn" aria-label="Сховати повідомлення" @click="dismissLoadNotice()"><AppIcon name="x" /></button>
  </div>
</template>
