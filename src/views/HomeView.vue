<script setup>
import { computed } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import InspCard from "../components/InspCard.vue";
import InstallCard from "../components/InstallCard.vue";
import StorageNotice from "../components/StorageNotice.vue";
import BackupCard from "../components/BackupCard.vue";
import AccountCard from "../components/AccountCard.vue";
import { db } from "../store";
import { switchTab } from "../nav";

const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const active = computed(() => list.value.filter(i => !i.done));
const done = computed(() => list.value.filter(i => i.done));
const hasAny = computed(() => list.value.length > 0);
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar root />
    <div class="content" :class="enter">
      <header class="page-head">
        <p class="kicker">Golf Check · огляд авто перед покупкою</p>
        <h1 class="title">Мої огляди</h1>
      </header>
      <StorageNotice />

      <section v-if="!hasAny" class="empty" data-empty="home">
        <div class="empty-ic"><AppIcon name="car" cls="lg" /></div>
        <h2 class="empty-t">Ще немає оглядів</h2>
        <p class="empty-s">Обери модель, двигун, кузов і рік. Отримаєш покроковий чек-лист саме для цієї конфігурації, її типові хвороби та звіт із вердиктом і бюджетом для торгу.</p>
        <button class="btn" data-action="new" @click="switchTab('/new')"><AppIcon name="plus" /><span>Створити огляд</span></button>
      </section>

      <template v-else>
        <section v-if="active.length" aria-labelledby="h-active">
          <h2 id="h-active" class="h2">В процесі</h2>
          <div class="cards"><InspCard v-for="(i, k) in active" :key="i.id" :i="i" :featured="k === 0" /></div>
        </section>
        <section v-if="done.length" aria-labelledby="h-done">
          <h2 id="h-done" class="h2">Завершені</h2>
          <div class="cards"><InspCard v-for="i in done" :key="i.id" :i="i" /></div>
        </section>
      </template>

      <AccountCard />
      <InstallCard />
      <BackupCard />
      <p class="foot center" style="margin-top: var(--s5)">Огляди зберігаються на цьому телефоні, а після входу через Telegram — ще й у хмарі. Резервна копія вбереже їх, якщо браузер очистить сховище.</p>
    </div>
  </AppScreen>
</template>
