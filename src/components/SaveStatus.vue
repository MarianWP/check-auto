<script setup>
import { computed } from "vue";
import { storage } from "../store";
import { user } from "../cloud/auth";
import { sync, fullSync } from "../cloud/sync";
const text = computed(() => !storage.ok ? "Не збережено на пристрої" : !user.value ? "Збережено на пристрої" : sync.state === "error" ? "На пристрої · хмара недоступна" : sync.state === "syncing" ? "Синхронізація…" : sync.pending ? "На пристрої · очікує відправлення" : sync.lastAt ? "Збережено в хмарі" : "Збережено на пристрої");
</script>
<template>
  <p class="save-status foot" role="status" :class="{ 'text-bad': !storage.ok }">{{ text }}<button v-if="user && sync.state === 'error'" class="link" @click="fullSync()">Повторити</button></p>
</template>
