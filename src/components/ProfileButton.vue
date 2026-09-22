<script setup>
/* Кнопка профілю у шапці кореневих екранів: аватар або ініціал після входу, силует до входу. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { auth, user, displayName } from "../cloud/auth";
import { go } from "../nav";

const photo = computed(() => (auth.profile && auth.profile.photo_url) || (user.value && user.value.user_metadata && user.value.user_metadata.photo_url) || "");
const initial = computed(() => displayName.value.slice(0, 1).toUpperCase());
</script>

<template>
  <button class="icon-btn tonal profile-btn" data-action="profile" data-to="/profile" :aria-label="user ? 'Профіль: ' + displayName : 'Профіль і налаштування'" @click="go('/profile')">
    <img v-if="photo" class="profile-img" :src="photo" alt="" referrerpolicy="no-referrer">
    <span v-else-if="user" class="profile-initial" aria-hidden="true">{{ initial }}</span>
    <AppIcon v-else name="user" />
  </button>
</template>
