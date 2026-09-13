<script setup>
import G from "../data/golf";

const vin = G.VIN;
const plants = G.PLANTS;
</script>

<template>
  <h2 class="section-h">VIN, роки і заводи</h2>
  <div class="group">
    <div class="row-block sub">{{ vin.intro }}</div>
    <div class="row-block"><dl class="kv"><template v-for="(r, k) in vin.rows" :key="k"><dt class="num">{{ r[0] }}</dt><dd>{{ r[1] }}</dd></template></dl></div>
    <div class="row-block"><div class="foot strong" style="margin-bottom:6px">ДЕ ШУКАТИ VIN</div><ul class="list"><li v-for="(p, k) in vin.places" :key="k">{{ p }}</li></ul></div>
    <div class="row-block"><div class="foot strong" style="margin-bottom:6px">ЗАВОДИ (11-Й СИМВОЛ)</div><dl class="kv"><template v-for="p in plants" :key="p.code"><dt>{{ p.code }}</dt><dd>{{ p.name }} <span class="muted">— {{ p.note }}</span></dd></template></dl></div>
  </div>
</template>
