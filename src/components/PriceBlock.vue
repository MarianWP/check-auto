<script setup>
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import G from "../data/golf";
import { money, fmtN } from "../store";

const props = defineProps({ i: { type: Object, required: true }, price: { type: Object, required: true } });
const M = G.MARKET;
const cmp = computed(() => {
  const i = props.i, p = props.price;
  if (!i.price) return null;
  if (i.price > p.hi) return { cls: "text-bad", txt: "на " + money(i.price - p.hi) + " вище верхньої межі" };
  if (i.price < p.lo) return { cls: "text-warn", txt: "нижче ринку на " + money(p.lo - i.price) + " — спитай, чому" };
  return { cls: "text-good", txt: "у межах ринку" };
});
</script>

<template>
  <h2 class="section-h">Ринкова ціна в Україні</h2>
  <div class="group">
    <div class="price-card">
      <div class="price-big num">{{ money(price.lo) }} – {{ fmtN(price.hi) }}</div>
      <p class="sub" style="margin-top:6px">Орієнтовно для цієї конфігурації. Середня по всіх Golf V на auto.ria — {{ money(M.avg) }} ({{ M.updated }}). Дизель дорожчий, бензин дешевший, ГБО — найдешевше.</p>
      <div v-if="cmp" class="price-cmp"><span class="muted">Продавець:</span><b class="num">{{ money(i.price) }}</b><span :class="cmp.cls">· {{ cmp.txt }}</span></div>
      <p style="margin-top:12px"><a class="foot" style="display:inline-flex;align-items:center;gap:6px;font-weight:500" :href="M.search" target="_blank" rel="noopener">Актуальні оголошення на auto.ria <AppIcon name="external" cls="sm" /></a></p>
    </div>
  </div>
</template>
