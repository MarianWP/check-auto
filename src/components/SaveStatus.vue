<script setup>
/* Стан збереження показуємо лише тоді, коли щось не так: зміни не записались, хмара недоступна
   або є невідправлене без мережі. Коли все гаразд, рядка немає — це очікувана норма, а не новина. */
import { computed } from "vue";
import { storage } from "../store";
import { user } from "../cloud/auth";
import { sync, fullSync } from "../cloud/sync";
const text = computed(() => {
  if (!storage.ok) return "Не збережено на пристрої";
  if (!user.value) return "";
  if (sync.state === "error") return "Хмара недоступна, зміни на пристрої";
  if (sync.pending && sync.state !== "syncing" && typeof navigator !== "undefined" && !navigator.onLine) return "Без мережі · не відправлено: " + sync.pending;
  return "";
});
</script>
<template>
  <p v-if="text" class="save-status foot" role="status" :class="{ 'text-bad': !storage.ok }">{{ text }}<button v-if="user && sync.state === 'error'" class="link" @click="fullSync()">Повторити</button></p>
</template>
