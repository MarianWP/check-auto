<script setup>
/* Смужка фото до проблеми або пункту: мініатюри, тап відкриває перегляд. Порожній список нічого не малює.
   Мініатюра — окремий маленький файл; у старих фото її немає, тоді після помилки беремо оригінал.
   crossorigin: відповідь без CORS service worker не кешує, а сховище Supabase CORS віддає. */
import { reactive } from "vue";
import { publicUrl } from "../cloud/client";
import { thumbPath } from "../logic/content";
import { openLightbox } from "../store";

defineProps({ photos: { type: Array, default: () => [] } });
const noThumb = reactive({});
const src = p => publicUrl(noThumb[p.id] ? p.path : thumbPath(p.path));
</script>

<template>
  <div v-if="photos.length" class="photo-strip" role="list" aria-label="Фото прикладів">
    <button v-for="p in photos" :key="p.id" class="thumb" role="listitem" :aria-label="p.caption || 'Фото прикладу'" @click="openLightbox(publicUrl(p.path), p.caption)">
      <img :src="src(p)" :alt="p.caption || ''" loading="lazy" decoding="async" crossorigin="anonymous" @error="noThumb[p.id] = true">
    </button>
  </div>
</template>
