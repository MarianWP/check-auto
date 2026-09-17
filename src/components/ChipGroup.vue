<script setup>
/* Вибір одного значення. Вибране позначене заливкою і галочкою, а не лише кольором. */
import AppIcon from "./AppIcon.vue";

defineProps({
  list: { type: Array, required: true },
  sel: { type: [String, Number], default: null },
  k: { type: String, required: true },
  label: { type: String, default: "" }
});
defineEmits(["pick"]);
</script>

<template>
  <div class="chips" role="group" :aria-label="label || null">
    <button v-for="o in list" :key="o.id" class="chip" :class="{ on: sel === o.id }" data-action="draft" :data-k="k" :data-v="o.id" :aria-pressed="sel === o.id" @click="$emit('pick', k, o.id)">
      <AppIcon v-if="sel === o.id" name="check" /><span>{{ o.name }}</span>
    </button>
  </div>
</template>
