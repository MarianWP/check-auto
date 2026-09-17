<script setup>
/* Тост стоїть на якорі нульової висоти між екраном і нижніми панелями, тож завжди з'являється над ними. */
import { ui } from "../store";
</script>

<template>
  <div class="toast-anchor" aria-live="polite">
    <transition name="toast">
      <div v-if="ui.toast" :key="ui.toast.id" class="toast" role="status">{{ ui.toast.msg }}</div>
    </transition>
  </div>
</template>
