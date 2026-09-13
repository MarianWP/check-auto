<script setup>
import AppIcon from "./AppIcon.vue";
import IssueRow from "./IssueRow.vue";
import G from "../data/golf";

const list = G.COMMON;
</script>

<template>
  <h2 class="section-h">Спільні хвороби Golf V</h2>
  <div class="group">
    <details class="acc">
      <summary><AppIcon name="wrench" /><span>Кузов, електрика, підвіска</span><span class="muted" style="margin-left:auto;font-size:15px">{{ list.length }}</span><AppIcon name="chev" cls="chev" /></summary>
      <IssueRow v-for="(x, k) in list" :key="k" :x="x" />
    </details>
  </div>
</template>
