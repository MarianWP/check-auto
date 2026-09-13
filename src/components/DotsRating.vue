<script setup>
defineProps({ r: { type: Number, required: true } });
</script>

<template>
  <span class="dots" :class="'r' + r" :aria-label="'Надійність ' + r + ' з 5'"><i v-for="k in 5" :key="k" :class="{ on: k <= r }"></i></span>
</template>
