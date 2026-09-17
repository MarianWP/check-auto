<script setup>
import G from "../data/golf";

const kit = G.KIT;
</script>

<template>
  <section id="sec-kit" class="anchor" aria-labelledby="h-kit">
    <h2 id="h-kit" class="h2">Що взяти з собою</h2>
    <div class="card"><ul class="list"><li v-for="(k, n) in kit" :key="n">{{ k }}</li></ul></div>
  </section>
</template>
