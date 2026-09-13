<script setup>
defineProps({
  list: { type: Array, required: true },
  sel: { type: [String, Number], default: null },
  k: { type: String, required: true }
});
defineEmits(["pick"]);
</script>

<template>
  <div class="chips">
    <button v-for="o in list" :key="o.id" class="chip" :class="{ on: sel === o.id }" data-action="draft" :data-k="k" :data-v="o.id" :aria-pressed="sel === o.id" @click="$emit('pick', k, o.id)">{{ o.name }}</button>
  </div>
</template>
