<script setup>
/* Кругла кнопка праворуч у нижній навігації, завжди на виду. Після входу — аватар або ініціал (профіль),
   гостю — шестерня (налаштування: тема, резервна копія, вхід). */
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { auth, user, displayName } from "../cloud/auth";
import { go } from "../nav";

const route = useRoute();
const photo = computed(() => (auth.profile && auth.profile.photo_url) || (user.value && user.value.user_metadata && user.value.user_metadata.photo_url) || "");
const initial = computed(() => displayName.value.slice(0, 1).toUpperCase());
</script>

<template>
  <button class="nav-profile" :class="{ on: route.name === 'profile', guest: !user }" data-action="profile" data-to="/profile"
    :aria-label="user ? 'Профіль: ' + displayName : 'Налаштування'" :aria-current="route.name === 'profile' ? 'page' : null" @click="go('/profile')">
    <img v-if="user && photo" class="profile-img" :src="photo" alt="" referrerpolicy="no-referrer">
    <span v-else-if="user" class="profile-initial" aria-hidden="true">{{ initial }}</span>
    <AppIcon v-else name="settings" />
  </button>
</template>
