<script setup>
import AppIcon from "./AppIcon.vue";
import { costStr, SEV_LABEL } from "../store";

defineProps({ x: { type: Object, required: true } });
</script>

<template>
  <div class="issue">
    <div class="issue-t">{{ x.t }}</div>
    <div class="issue-d">{{ x.d }}</div>
    <div v-if="x.sev || (x.cost && x.cost[1])" class="issue-meta">
      <span v-if="x.sev" class="sev" :class="'sev-' + x.sev"><AppIcon v-if="x.sev === 'crit'" name="alert" />{{ SEV_LABEL[x.sev] }}</span>
      <span v-if="x.cost && x.cost[1]" class="issue-c">≈ {{ costStr(x.cost) }}</span>
    </div>
  </div>
</template>
