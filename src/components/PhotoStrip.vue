<script setup>
/* Смужка фото до проблеми або пункту: мініатюри, тап відкриває перегляд. Порожній список нічого не малює. */
import { publicUrl } from "../cloud/client";
import { openLightbox } from "../store";

defineProps({ photos: { type: Array, default: () => [] } });
</script>

<template>
  <div v-if="photos.length" class="photo-strip" role="list" aria-label="Фото прикладів">
    <button v-for="p in photos" :key="p.id" class="thumb" role="listitem" :aria-label="p.caption || 'Фото прикладу'" @click="openLightbox(publicUrl(p.path), p.caption)">
      <img :src="publicUrl(p.path)" :alt="p.caption || ''" loading="lazy" decoding="async">
    </button>
  </div>
</template>
