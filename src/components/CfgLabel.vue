<script setup>
/* Рядок конфігурації авто. Короткі частини («5-дв.», «МКПП-5», рік) не розриваються посередині при переносі. */
import { computed } from "vue";
import G from "../data/golf";

const props = defineProps({
  cfg: { type: Object, required: true },
  /* short: двигун · рік · кузов · коробка (скорочено); rest: кузов · коробка (повні назви, без двигуна й року) */
  mode: { type: String, default: "short" }
});
const parts = computed(() => {
  const e = G.engine(props.cfg.engine), b = G.body(props.cfg.body), g = G.gearbox(props.cfg.gear);
  return props.mode === "rest" ? [b.name, g.name] : [e.name, String(props.cfg.year), b.short, g.short];
});
</script>

<template>
  <span class="cfg"><template v-for="(p, k) in parts" :key="k"><span :class="{ nw: p.length <= 12 }">{{ p }}</span><span v-if="k < parts.length - 1"> · </span></template></span>
</template>
