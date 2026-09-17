<script setup>
import IssueRow from "./IssueRow.vue";

defineProps({ e: { type: Object, required: true } });
</script>

<template>
  <section aria-labelledby="h-engine">
    <h2 id="h-engine" class="h2">Про двигун {{ e.name }}</h2>
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
    <h2 id="h-engine-issues" class="h2">Типові проблеми двигуна</h2>
    <div class="group"><IssueRow v-for="(x, k) in e.issues" :key="k" :x="x" /></div>
  </section>
</template>
