<script setup>
/* Попередження на екранах адмінки, коли зберігати нікуди або немає прав: форму видно, але база відхилить запис. */
import AppIcon from "./AppIcon.vue";
import { auth, user, isAdmin } from "../cloud/auth";
</script>

<template>
  <div v-if="!auth.enabled" class="notice info" data-notice="admin-gate"><AppIcon name="alert" /><div><b>Хмару не підключено</b>Без ключів Supabase у збірці зміни нікуди не збережуться.</div></div>
  <div v-else-if="auth.ready && !user" class="notice warn" data-notice="admin-gate"><AppIcon name="alert" /><div><b>Потрібен вхід</b>Увійди через Telegram на головній: без входу база відхилить збереження.</div></div>
  <div v-else-if="auth.ready && !isAdmin" class="notice warn" data-notice="admin-gate"><AppIcon name="alert" /><div><b>Немає прав адміністратора</b>Роль вмикається у базі: profiles → role = admin.</div></div>
</template>
