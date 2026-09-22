<script setup>
import { modelApi } from "../data/index.js";

const props = defineProps({ model: { type: String, default: "golf5" } });
const G = modelApi(props.model);
const vin = G.VIN;
const plants = G.PLANTS;
</script>

<template>
  <section id="sec-vin" class="anchor" aria-labelledby="h-vin">
    <h2 id="h-vin" class="h2">VIN, роки і заводи</h2>
    <div class="group">
      <div class="row-block"><p class="prose">{{ vin.intro }}</p></div>
      <div class="row-block"><dl class="kv"><template v-for="(r, k) in vin.rows" :key="k"><dt>{{ r[0] }}</dt><dd>{{ r[1] }}</dd></template></dl></div>
      <div class="row-block"><h3 class="row-t" style="margin-bottom: var(--s2)">Де шукати VIN</h3><ul class="list"><li v-for="(p, k) in vin.places" :key="k">{{ p }}</li></ul></div>
      <div class="row-block"><h3 class="row-t" style="margin-bottom: var(--s2)">Заводи</h3><dl class="kv"><template v-for="p in plants" :key="p.code + p.name"><dt>{{ p.code }}</dt><dd>{{ p.name }} <span class="muted">— {{ p.note }}</span></dd></template></dl></div>
    </div>
  </section>
</template>
