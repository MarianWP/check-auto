<script setup>
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { tgState } from "../tg";
import { db, hideInstall } from "../store";

const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const show = computed(() => !standalone && !db.hideInstall && !tgState.active);
</script>

<template>
  <div v-if="show" class="notice info install" style="margin-top: var(--s6)">
    <AppIcon name="share" />
    <div>
      <b>Додай на Початковий екран</b>
      <template v-if="ios">У Safari натисни «Поділитися», потім «На Початковий екран». Застосунок працюватиме офлайн.</template>
      <template v-else>Відкрий цю сторінку в Safari на iPhone і додай на Початковий екран через меню «Поділитися».</template>
    </div>
    <button class="icon-btn" data-action="hide-install" aria-label="Сховати підказку" @click="hideInstall()"><AppIcon name="x" /></button>
  </div>
</template>
