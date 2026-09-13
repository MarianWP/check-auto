<script setup>
import G from "../data/golf";

const kit = G.KIT;
</script>

<template>
  <h2 class="section-h">Що взяти з собою</h2>
  <div class="group"><div class="row-block"><ul class="list"><li v-for="(k, n) in kit" :key="n">{{ k }}</li></ul></div></div>
</template>
