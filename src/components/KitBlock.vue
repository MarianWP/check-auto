<script setup>
import SecTitle from "./SecTitle.vue";
import { modelApi } from "../data/index.js";

const props = defineProps({ model: { type: String, default: "golf5" } });
const kit = modelApi(props.model).KIT;
</script>

<template>
  <section id="sec-kit" class="anchor" aria-labelledby="h-kit">
    <SecTitle id="h-kit" icon="backpack">Що взяти з собою</SecTitle>
    <div class="card"><ul class="list"><li v-for="(k, n) in kit" :key="n">{{ k }}</li></ul></div>
  </section>
</template>
