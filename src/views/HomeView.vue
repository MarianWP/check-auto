<script setup>
import { ref, computed } from "vue";
import SaveStatus from "../components/SaveStatus.vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import SecTitle from "../components/SecTitle.vue";
import InspCard from "../components/InspCard.vue";
import InstallCard from "../components/InstallCard.vue";
import StorageNotice from "../components/StorageNotice.vue";
import BackupCard from "../components/BackupCard.vue";
import ProfileButton from "../components/ProfileButton.vue";
import { db } from "../store";
import { switchTab } from "../nav";

const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const query = ref("");
const filtered = computed(() => list.value.filter(i => !query.value.trim() || [i.name, i.model, i.cfg.year].join(" ").toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
const active = computed(() => filtered.value.filter(i => !i.done));
const done = computed(() => filtered.value.filter(i => i.done));
const hasAny = computed(() => list.value.length > 0);
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar root />
    <div class="content" :class="enter">
      <header class="page-head head-row">
        <div><p class="kicker">Golf Check · огляд авто перед покупкою</p><h1 class="title">Мої огляди</h1></div>
        <ProfileButton />
      </header>
      <StorageNotice />
      <SaveStatus />
      <label v-if="hasAny" class="field"><span class="field-label">Знайти огляд</span><input v-model="query" class="input" type="search" placeholder="Назва, модель або рік"></label>
      <p v-if="hasAny && !filtered.length" class="notice info">Нічого не знайдено. Спробуй іншу назву або рік.</p>

      <section v-if="!hasAny" class="empty" data-empty="home">
        <div class="empty-ic"><AppIcon name="car" cls="lg" /></div>
        <h2 class="empty-t">Ще немає оглядів</h2>
        <p class="empty-s">Обери модель, двигун, кузов і рік. Отримаєш покроковий чек-лист саме для цієї конфігурації, її типові хвороби та звіт із вердиктом і бюджетом для торгу.</p>
        <button class="btn" data-action="new" @click="switchTab('/new')"><AppIcon name="plus" /><span>Створити огляд</span></button>
      </section>

      <template v-else>
        <section v-if="active.length" aria-labelledby="h-active">
          <SecTitle id="h-active" icon="clipboard">В процесі</SecTitle>
          <div class="cards"><InspCard v-for="(i, k) in active" :key="i.id" :i="i" :featured="k === 0" /></div>
        </section>
        <section v-if="done.length" aria-labelledby="h-done">
          <SecTitle id="h-done" icon="circleCheck">Завершені</SecTitle>
          <div class="cards"><InspCard v-for="i in done" :key="i.id" :i="i" /></div>
        </section>
      </template>

      <InstallCard />
      <BackupCard />
      <p class="foot center" style="margin-top: var(--s5)">Огляди зберігаються на цьому телефоні, а після входу через Telegram у профілі — ще й у хмарі. Резервна копія вбереже їх, якщо браузер очистить сховище.</p>
    </div>
  </AppScreen>
</template>
