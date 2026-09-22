<script setup>
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import SecTitle from "./SecTitle.vue";
import { money, fmtN, apiOf } from "../store";

const props = defineProps({ i: { type: Object, required: true }, price: { type: Object, required: true } });
const G = apiOf(props.i);
const M = G.MARKET;
const cmp = computed(() => {
  const i = props.i, p = props.price;
  if (!i.price) return null;
  if (i.price > p.hi) return { cls: "text-bad", txt: "на " + money(i.price - p.hi) + " вище верхньої межі" };
  if (i.price < p.lo) return { cls: "text-warn", txt: "нижче ринку на " + money(p.lo - i.price) + " — спитай, чому" };
  return { cls: "text-ok", txt: "у межах ринку" };
});
</script>

<template>
  <section aria-labelledby="h-price">
    <SecTitle id="h-price" icon="coins">Ринкова ціна в Україні</SecTitle>
    <div class="card price">
      <div class="price-v">{{ money(price.lo) }} – {{ fmtN(price.hi) }}</div>
      <div v-if="cmp" class="price-cmp"><span class="muted">Продавець просить</span><b>{{ money(i.price) }}:</b><span :class="cmp.cls" class="strong">{{ cmp.txt }}</span></div>
      <p class="foot">Орієнтовно для цієї конфігурації. Середня по всіх {{ G.model.name }} на auto.ria — {{ money(M.avg) }} ({{ M.updated }}). Дизель дорожчий, бензин дешевший, ГБО — найдешевше.</p>
      <a class="link" :href="M.search" target="_blank" rel="noopener">Актуальні оголошення на auto.ria<AppIcon name="external" cls="sm" /></a>
    </div>
  </section>
</template>
