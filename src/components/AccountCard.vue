<script setup>
/* Акаунт на головній: вхід через Telegram, стан синхронізації, вихід, вхід до адмінки. */
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import TelegramLogin from "./TelegramLogin.vue";
import TG from "../tg";
import { auth, user, isAdmin, displayName, loginMiniApp, logout } from "../cloud/auth";
import { sync, fullSync } from "../cloud/sync";
import { dateStr } from "../store";
import { go } from "../nav";

const inTelegram = TG.active;
const photo = computed(() => (auth.profile && auth.profile.photo_url) || (user.value && user.value.user_metadata && user.value.user_metadata.photo_url) || "");
const initial = computed(() => displayName.value.slice(0, 1).toUpperCase());
const syncText = computed(() => {
  if (sync.state === "syncing") return "Синхронізація…";
  if (sync.state === "error") return "Помилка синхронізації: " + sync.error;
  if (sync.pending) return "Не надіслано змін: " + sync.pending;
  return sync.lastAt ? "Синхронізовано " + dateStr(sync.lastAt) : "Ще не синхронізовано";
});
</script>

<template>
  <section v-if="auth.enabled" aria-labelledby="h-account" data-account>
    <h2 id="h-account" class="h2">Акаунт</h2>

    <div v-if="!user" class="card account">
      <p class="prose">Увійди через Telegram, щоб огляди зберігалися в хмарі й були на всіх твоїх пристроях.</p>
      <button v-if="inTelegram" class="btn" data-action="login" :disabled="auth.busy" @click="loginMiniApp()"><AppIcon name="share" /><span>{{ auth.busy ? 'Входимо…' : 'Увійти через Telegram' }}</span></button>
      <TelegramLogin v-else />
      <p v-if="auth.error" class="foot text-bad">{{ auth.error }}</p>
    </div>

    <div v-else class="card account">
      <div class="account-head">
        <img v-if="photo" class="avatar" :src="photo" alt="" referrerpolicy="no-referrer">
        <span v-else class="avatar" aria-hidden="true">{{ initial }}</span>
        <div class="row-main">
          <div class="row-t">{{ displayName }}</div>
          <div class="row-s" data-sync-state>{{ syncText }}</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn tonal" data-action="sync" :disabled="sync.state === 'syncing'" @click="fullSync()"><span>Синхронізувати</span></button>
        <button class="btn ghost" data-action="logout" @click="logout()"><span>Вийти</span></button>
      </div>
      <button v-if="isAdmin" class="row admin-link" data-action="admin" @click="go('/admin')">
        <AppIcon name="pencil" />
        <div class="row-main"><div class="row-t">Адмінка</div><div class="row-s">Власні пункти чек-листа і фото до проблем</div></div>
        <AppIcon name="chev" cls="chev" />
      </button>
    </div>
  </section>
</template>
