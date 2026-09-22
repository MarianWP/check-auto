<script setup>
/* Профіль: акаунт Telegram і синхронізація, тема, мова помічника, адмінка. */
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import AccountCard from "../components/AccountCard.vue";
import ChipGroup from "../components/ChipGroup.vue";
import { prefs, setPref } from "../prefs";
import { THEMES, LANGS } from "../logic/prefs";
import { auth } from "../cloud/auth";
import { CLOUD_ERROR } from "../cloud/client";
import { toast } from "../store";

const THEME_OPTS = THEMES.map(t => ({ id: t.id, name: t.name }));
const LANG_OPTS = LANGS.map(l => ({ id: l.id, name: l.name }));
function pickTheme(_k, v) { setPref("theme", v); }
function pickLang(_k, v) { setPref("lang", v); toast("Помічник відповідатиме: " + LANGS.find(l => l.id === v).name); }
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/" back-label="мої огляди" title="Профіль" kicker="Golf Check · акаунт, тема, мова" />
    <div class="content" :class="enter">

      <AccountCard />
      <div v-if="!auth.enabled && !CLOUD_ERROR" class="notice info" data-notice="no-cloud"><AppIcon name="alert" /><div><b>Хмару не підключено</b>Вхід через Telegram, синхронізація між пристроями і помічник з'являться, коли адміністратор задасть ключі Supabase у збірці. Огляди зберігаються на цьому телефоні.</div></div>

      <section aria-labelledby="h-theme">
        <h2 id="h-theme" class="h2">Тема</h2>
        <div class="card fields">
          <ChipGroup :list="THEME_OPTS" :sel="prefs.theme" k="theme" label="Тема інтерфейсу" @pick="pickTheme" />
          <p class="hint">{{ THEMES.find(t => t.id === prefs.theme).desc }}</p>
        </div>
      </section>

      <section aria-labelledby="h-lang">
        <h2 id="h-lang" class="h2">Мова</h2>
        <div class="card fields">
          <ChipGroup :list="LANG_OPTS" :sel="prefs.lang" k="lang" label="Мова відповідей помічника" @pick="pickLang" />
          <p class="hint">Мова стосується відповідей помічника ШІ. Інтерфейс, чек-лист і довідник поки що лише українською.</p>
        </div>
      </section>
    </div>
  </AppScreen>
</template>
