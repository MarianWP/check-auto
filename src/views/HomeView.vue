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
import { db } from "../store";
import { switchTab } from "../nav";

const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const query = ref("");
const filtered = computed(() => list.value.filter(i => !query.value.trim() || [i.name, i.model, i.cfg.year].join(" ").toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
const active = computed(() => filtered.value.filter(i => !i.done));
const done = computed(() => filtered.value.filter(i => i.done));
const hasAny = computed(() => list.value.length > 0);
/* Пошук потрібен, лише коли оглядів уже багато; на короткому списку він тільки займає місце. */
const SEARCH_FROM = 6;
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar root />
    <div class="content" :class="enter">
      <header class="page-head">
        <h1 class="title">Мої огляди</h1>
      </header>
      <StorageNotice />
      <SaveStatus />
      <input v-if="list.length >= SEARCH_FROM" v-model="query" class="input search" type="search" placeholder="Пошук: назва, модель, рік" aria-label="Пошук огляду">
      <p v-if="hasAny && !filtered.length" class="foot">Нічого не знайдено</p>

      <section v-if="!hasAny" class="empty" data-empty="home">
        <div class="empty-ic"><AppIcon name="car" cls="lg" /></div>
        <h2 class="empty-t">Ще немає оглядів</h2>
        <p class="empty-s">Чек-лист, хвороби й вердикт під твоє авто</p>
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
    </div>
  </AppScreen>
</template>
