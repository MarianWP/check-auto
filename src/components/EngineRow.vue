<script setup>
import AppIcon from "./AppIcon.vue";
import DotsRating from "./DotsRating.vue";
import { costStr } from "../store";
import { go } from "../nav";

defineProps({ e: { type: Object, required: true } });
</script>

<template>
  <button class="row" data-action="go" :data-to="'/guide/' + e.id" @click="go('/guide/' + e.id)">
    <div class="row-main">
      <div class="row-t">{{ e.name }} <span class="muted">{{ e.hp }}</span></div>
      <div class="row-s" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><DotsRating :r="e.reliability" /><span class="num">{{ costStr(e.price) }}</span><span>{{ e.years[0] }}–{{ e.years[1] }}</span></div>
    </div>
    <AppIcon name="chev" cls="chev" />
  </button>
</template>
