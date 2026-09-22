<script setup>
import SecTitle from "./SecTitle.vue";
import DotsRating from "./DotsRating.vue";
import IssueRow from "./IssueRow.vue";
import { photosFor } from "../cloud/content";

defineProps({ g: { type: Object, required: true } });
</script>

<template>
  <section aria-labelledby="h-gear">
    <SecTitle id="h-gear" icon="settings">Коробка: {{ g.name }}</SecTitle>
    <div class="group">
      <div class="row-block">
        <p class="prose">{{ g.summary }}</p>
        <p class="engine-meta" style="margin-top: var(--s3)"><DotsRating :r="g.reliability" /><span>надійність {{ g.reliability }} з 5</span></p>
      </div>
      <IssueRow v-for="(x, k) in g.issues" :key="k" :x="x" :photos="photosFor('gearbox', g.id, k)" />
    </div>
  </section>
</template>
