<script setup>
/* Профіль як у Telegram: великий аватар, під ним ім'я і нік, нижче список пунктів налаштувань.
   Кожен пункт відкриває аркуш знизу або виконує дію одразу; мову відповідей помічника поки не показуємо. */
import { computed } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import TelegramLogin from "../components/TelegramLogin.vue";
import TG from "../tg";
import { prefs, setPref } from "../prefs";
import { THEMES } from "../logic/prefs";
import { auth, user, isAdmin, displayName, loginMiniApp, logout } from "../cloud/auth";
import { sync, fullSync } from "../cloud/sync";
import { CLOUD_ERROR } from "../cloud/client";
import { db, sheet, toast, dateStr } from "../store";
import { go } from "../nav";

const inTelegram = TG.active;
const photo = computed(() => (auth.profile && auth.profile.photo_url) || (user.value && user.value.user_metadata && user.value.user_metadata.photo_url) || "");
const initial = computed(() => displayName.value.slice(0, 1).toUpperCase());
const nick = computed(() => { const u = (auth.profile && auth.profile.username) || (user.value && user.value.user_metadata && user.value.user_metadata.username) || ""; return u ? "@" + u : ""; });
const themeName = computed(() => THEMES.find(t => t.id === prefs.theme).name);
const syncText = computed(() => {
  if (!user.value) return "Після входу огляди будуть на всіх пристроях";
  if (sync.state === "syncing") return "Синхронізація…";
  if (sync.state === "error") return "Помилка: " + sync.error;
  if (sync.pending) return "Не надіслано змін: " + sync.pending;
  return sync.lastAt ? "Синхронізовано " + dateStr(sync.lastAt) : "Ще не синхронізовано";
});
const count = computed(() => db.inspections.length);

function pickTheme() {
  sheet({ title: "Тема інтерфейсу", actions: THEMES.map(t => ({ label: t.name, sub: t.desc, on: prefs.theme === t.id, fn: () => setPref("theme", t.id) })) });
}
function askLogout() {
  sheet({ title: "Вийти з акаунта?", text: "Огляди лишаться на цьому телефоні. Хмара і помічник стануть недоступні до наступного входу.", actions: [{ icon: "x", label: "Вийти", danger: true, fn: logout }] });
}
async function doSync() { if (sync.state === "syncing") return; await fullSync(); toast(sync.error ? "Не вдалося синхронізувати" : "Синхронізовано"); }
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/" back-label="мої огляди" title="Профіль" />
    <div class="content" :class="enter">
      <section class="profile-hero" data-profile-hero>
        <img v-if="photo" class="avatar-xl" :src="photo" alt="" referrerpolicy="no-referrer">
        <span v-else class="avatar-xl" aria-hidden="true"><template v-if="user">{{ initial }}</template><AppIcon v-else name="user" cls="lg" /></span>
        <h2 class="profile-name" data-profile-name>{{ user ? displayName : 'Гість' }}</h2>
        <p class="profile-sub">{{ user ? (nick || 'Telegram') : (auth.enabled ? 'Не увійшов' : 'Огляди зберігаються на цьому телефоні') }}</p>
      </section>

      <div v-if="CLOUD_ERROR" class="notice warn" data-notice="cloud-error"><AppIcon name="alert" /><div><b>Хмару налаштовано з помилкою</b>{{ CLOUD_ERROR }}. Апка працює локально.</div></div>

      <div v-if="auth.enabled && !user" class="card account" data-account>
        <p class="prose">Увійди через Telegram, щоб огляди зберігалися в хмарі, а помічник відповідав про твої авто.</p>
        <button v-if="inTelegram" class="btn" data-action="login" :disabled="auth.busy" @click="loginMiniApp()"><AppIcon name="share" /><span>{{ auth.busy ? 'Входимо…' : 'Увійти через Telegram' }}</span></button>
        <TelegramLogin v-else />
        <p v-if="auth.error" class="foot text-bad">{{ auth.error }}</p>
      </div>

      <div class="group" style="margin-top: var(--s4)">
        <button class="row" data-action="theme" @click="pickTheme">
          <AppIcon name="palette" />
          <div class="row-main"><div class="row-t">Тема</div><div class="row-s" data-theme-name>{{ themeName }}</div></div>
          <AppIcon name="chev" cls="chev" />
        </button>
        <button class="row" data-action="sync" :disabled="!user || sync.state === 'syncing'" @click="doSync">
          <AppIcon name="upload" />
          <div class="row-main"><div class="row-t">Синхронізація</div><div class="row-s" data-sync-state>{{ syncText }}</div></div>
          <AppIcon v-if="user" name="chev" cls="chev" />
        </button>
        <button class="row" data-action="go" data-to="/" @click="go('/')">
          <AppIcon name="clipboard" />
          <div class="row-main"><div class="row-t">Мої огляди</div><div class="row-s">{{ count ? 'Оглядів: ' + count : 'Ще немає оглядів' }} · резервна копія на головній</div></div>
          <AppIcon name="chev" cls="chev" />
        </button>
        <button v-if="isAdmin" class="row" data-action="admin" @click="go('/admin')">
          <AppIcon name="pencil" />
          <div class="row-main"><div class="row-t">Адмінка</div><div class="row-s">Власні пункти чек-листа і фото до проблем</div></div>
          <AppIcon name="chev" cls="chev" />
        </button>
      </div>

      <div v-if="user" class="group" style="margin-top: var(--s4)">
        <button class="row danger" data-action="logout" @click="askLogout">
          <AppIcon name="x" />
          <div class="row-main"><div class="row-t">Вийти з акаунта</div></div>
        </button>
      </div>
      <p class="foot center" style="margin-top: var(--s5)">Golf Check · огляд авто перед покупкою</p>
    </div>
  </AppScreen>
</template>
