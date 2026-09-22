<script setup>
/* Адмінка: вхід до розділів. Доступ лише з роллю admin у profiles (RLS у базі перевіряє те саме). */
import { computed } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import { auth, user, isAdmin } from "../cloud/auth";
import { content } from "../cloud/content";
import { extraItems, MODELS } from "../store";
import { go } from "../nav";

const itemsCount = computed(() => extraItems.list.length);
const photosCount = computed(() => content.photos.length);
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/" back-label="мої огляди" title="Адмінка" />
    <div class="content" :class="enter">
      <header class="page-head">
        <p class="kicker">Golf Check</p>
        <h1 class="title">Адмінка</h1>
      </header>

      <div v-if="!auth.enabled" class="notice info"><AppIcon name="alert" /><div><b>Хмару не підключено</b>Задай ключі Supabase у збірці, щоб адмінка запрацювала.</div></div>
      <div v-else-if="!user" class="notice warn"><AppIcon name="alert" /><div><b>Потрібен вхід</b>Увійди через Telegram на головній.</div></div>
      <div v-else-if="!isAdmin" class="notice warn" data-notice="no-admin"><AppIcon name="alert" /><div><b>Немає доступу</b>Твоєму акаунту не надано роль адміністратора. Роль вмикається у базі: profiles → role = admin.</div></div>

      <template v-else>
        <div class="group" style="margin-top: var(--s4)">
          <button class="row" data-action="go" data-to="/admin/items" @click="go('/admin/items')">
            <AppIcon name="clipboard" />
            <div class="row-main"><div class="row-t">Пункти чек-листа</div><div class="row-s">Власні перевірки для всіх моделей або однієї · увімкнено: {{ itemsCount }}</div></div>
            <AppIcon name="chev" cls="chev" />
          </button>
          <button class="row" data-action="go" data-to="/admin/photos" @click="go('/admin/photos')">
            <AppIcon name="upload" />
            <div class="row-main"><div class="row-t">Фото до проблем</div><div class="row-s">Приклади, як виглядає хвороба або пункт перевірки · фото: {{ photosCount }}</div></div>
            <AppIcon name="chev" cls="chev" />
          </button>
        </div>
        <section aria-labelledby="h-models">
          <h2 id="h-models" class="h2">Моделі</h2>
          <div class="group">
            <div v-for="m in MODELS" :key="m.id" class="row-block"><div class="row-t">{{ m.brand }} {{ m.name }}<span v-if="m.draft" class="sev sev-minor" style="margin-left: var(--s2)">чернетка</span></div><div class="row-s">{{ m.years[0] }}–{{ m.years[1] }} · двигунів: {{ m.engines.length }} · кузовів: {{ m.bodies.length }}</div></div>
          </div>
          <p class="hint">Двигуни, кузови й ціни моделей живуть у коді (src/data/models). Зміни туди йдуть через репозиторій, а власні пункти й фото — звідси.</p>
        </section>
      </template>
    </div>
  </AppScreen>
</template>
