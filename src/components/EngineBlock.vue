<script setup>
import SecTitle from "./SecTitle.vue";
import IssueRow from "./IssueRow.vue";
import { photosFor } from "../cloud/content";

defineProps({ e: { type: Object, required: true } });
</script>

<template>
  <section aria-labelledby="h-engine">
    <SecTitle id="h-engine" icon="cog">Про двигун {{ e.name }}</SecTitle>
    <div class="card">
      <p class="prose">{{ e.summary }}</p>
      <p class="callout"><b class="strong">Вердикт:</b> {{ e.verdict }}</p>
      <dl class="kv" style="margin-top: var(--s4)">
        <dt>Коди</dt><dd>{{ e.codes }}</dd>
        <dt>ГРМ</dt><dd>{{ e.timing.text }}</dd>
      </dl>
    </div>
  </section>
  <section aria-labelledby="h-engine-issues">
    <SecTitle id="h-engine-issues" icon="wrench">Типові проблеми двигуна</SecTitle>
    <div class="group"><IssueRow v-for="(x, k) in e.issues" :key="k" :x="x" :photos="photosFor('engine', e.id, k)" /></div>
  </section>
</template>
