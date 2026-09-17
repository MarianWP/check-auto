<script setup>
/* Надійність 1–5 кольоровою шкалою: 4–5 зелені, 3 оранжеві, 1–2 червоні. Поруч завжди є текст «N з 5». */
defineProps({ r: { type: Number, required: true } });
</script>

<template>
  <span class="dots" :class="'r' + r" role="img" :aria-label="'Надійність ' + r + ' з 5'"><i v-for="k in 5" :key="k" :class="{ on: k <= r }"></i></span>
</template>
