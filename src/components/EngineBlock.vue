<script setup>
import { computed } from "vue";
import DotsRating from "./DotsRating.vue";
import IssueRow from "./IssueRow.vue";

const props = defineProps({ e: { type: Object, required: true } });
const lpg = computed(() => ({ ok: "підходить", hard: "невигідно й ризиковано", no: "не ставити" })[props.e.lpg]);
</script>

<template>
  <h2 class="section-h">Двигун {{ e.name }}</h2>
  <div class="group">
    <div class="row-block"><p class="body">{{ e.summary }}</p><p class="sub" style="margin-top:8px"><b class="strong" style="color:var(--label)">Вердикт:</b> {{ e.verdict }}</p></div>
    <div class="row-block">
      <dl class="kv">
        <dt>Потужність</dt><dd>{{ e.hp }}</dd>
        <dt>Коди</dt><dd>{{ e.codes }}</dd>
        <dt>ГРМ</dt><dd>{{ e.timing.text }}</dd>
        <dt>Надійність</dt><dd style="display:flex;align-items:center;gap:8px"><DotsRating :r="e.reliability" /><span class="muted">{{ e.reliability }} з 5</span></dd>
        <dt>ГБО</dt><dd>{{ lpg }}</dd>
      </dl>
    </div>
  </div>
  <h2 class="section-h">Типові проблеми цього мотора</h2>
  <div class="group"><IssueRow v-for="(x, k) in e.issues" :key="k" :x="x" /></div>
</template>
