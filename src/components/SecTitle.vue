<script setup>
/* Заголовок блока з іконкою: іконка у плитці ліворуч відділяє блоки один від одного краще, ніж сам текст. */
import AppIcon from "./AppIcon.vue";

defineProps({
  id: { type: String, default: null },
  icon: { type: String, default: "" }
});
</script>

<template>
  <h2 :id="id" class="h2" :class="{ 'has-ic': !!icon }">
    <span v-if="icon" class="h2-ic" aria-hidden="true"><AppIcon :name="icon" /></span>
    <span class="h2-t"><slot></slot></span>
  </h2>
</template>
