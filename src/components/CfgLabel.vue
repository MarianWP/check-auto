<script setup>
/* Рядок конфігурації авто. Короткі частини («5-дв.», «МКПП-5», рік) не розриваються посередині при переносі.
   Спереду завжди коротка назва моделі, бо оглядів може бути кілька різних моделей. */
import { computed } from "vue";
import { modelApi } from "../data/index.js";

const props = defineProps({
  cfg: { type: Object, required: true },
  model: { type: String, default: "golf5" },
  /* short: модель · двигун · рік · кузов · коробка (скорочено); rest: модель · кузов · коробка (повні назви) */
  mode: { type: String, default: "short" }
});
const parts = computed(() => {
  const G = modelApi(props.model);
  const e = G.engine(props.cfg.engine), b = G.body(props.cfg.body), g = G.gearbox(props.cfg.gear);
  const base = [G.model.short];
  return props.mode === "rest" ? base.concat([b && b.name, g && g.name]).filter(Boolean) : base.concat([e && e.name, String(props.cfg.year), b && b.short, g && g.short]).filter(Boolean);
});
</script>

<template>
  <span class="cfg"><template v-for="(p, k) in parts" :key="k"><span :class="{ nw: p.length <= 12 }">{{ p }}</span><span v-if="k < parts.length - 1"> · </span></template></span>
</template>
