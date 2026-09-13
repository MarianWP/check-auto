<script setup>
import DotsRating from "./DotsRating.vue";
import IssueRow from "./IssueRow.vue";

defineProps({ g: { type: Object, required: true } });
</script>

<template>
  <h2 class="section-h">Коробка: {{ g.short }}</h2>
  <div class="group">
    <div class="row-block"><p class="body">{{ g.summary }}</p><p class="sub" style="margin-top:8px;display:flex;align-items:center;gap:8px"><DotsRating :r="g.reliability" />надійність {{ g.reliability }} з 5</p></div>
    <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x" />
  </div>
</template>
