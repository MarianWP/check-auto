<script setup>
import { costStr } from "../store";

defineProps({ x: { type: Object, required: true } });
</script>

<template>
  <div class="issue">
    <span class="dot" :class="x.sev || ''"></span>
    <div class="row-main"><div class="issue-t">{{ x.t }}</div><div class="issue-d">{{ x.d }}</div></div>
    <span v-if="x.cost && x.cost[1]" class="issue-c">{{ costStr(x.cost) }}</span>
  </div>
</template>
