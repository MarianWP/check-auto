<script setup>
import AppIcon from "./AppIcon.vue";
import DotsRating from "./DotsRating.vue";
import { costStr } from "../store";
import { go } from "../nav";

defineProps({ e: { type: Object, required: true }, model: { type: String, default: "golf5" } });
</script>

<template>
  <button class="row" data-action="go" :data-to="'/guide/' + model + '/' + e.id" @click="go('/guide/' + model + '/' + e.id)">
    <div class="row-main">
      <div class="row-t">{{ e.name }} <span class="muted" style="font-weight: 450">{{ e.hp }}</span></div>
      <div class="engine-meta"><DotsRating :r="e.reliability" /><span>{{ e.reliability }} з 5</span><span>{{ costStr(e.price) }}</span><span>{{ e.years[0] }}–{{ e.years[1] }}</span></div>
    </div>
    <AppIcon name="chev" cls="chev" />
  </button>
</template>
