<script setup>
/* Надійність 1–5: світлі крапки без кольорових значень, поруч завжди є текст «N з 5». */
defineProps({ r: { type: Number, required: true } });
</script>

<template>
  <span class="dots" role="img" :aria-label="'Надійність ' + r + ' з 5'"><i v-for="k in 5" :key="k" :class="{ on: k <= r }"></i></span>
</template>
