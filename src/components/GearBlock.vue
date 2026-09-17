<script setup>
import DotsRating from "./DotsRating.vue";
import IssueRow from "./IssueRow.vue";

defineProps({ g: { type: Object, required: true } });
</script>

<template>
  <section aria-labelledby="h-gear">
    <h2 id="h-gear" class="h2">Коробка: {{ g.name }}</h2>
    <div class="group">
      <div class="row-block">
        <p class="prose">{{ g.summary }}</p>
        <p class="engine-meta" style="margin-top: var(--s3)"><DotsRating :r="g.reliability" /><span>надійність {{ g.reliability }} з 5</span></p>
      </div>
      <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x" />
    </div>
  </section>
</template>
