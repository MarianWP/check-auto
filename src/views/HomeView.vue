<script setup>
import { computed } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import InspRow from "../components/InspRow.vue";
import InstallCard from "../components/InstallCard.vue";
import StorageNotice from "../components/StorageNotice.vue";
import BackupCard from "../components/BackupCard.vue";
import { db } from "../store";
import { switchTab } from "../nav";

const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const active = computed(() => list.value.filter(i => !i.done));
const done = computed(() => list.value.filter(i => i.done));
const hasAny = computed(() => list.value.length > 0);
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar title="Golf Check" title-on-scroll />
    <div class="content" :class="enter">
      <h1 class="large-title">Golf Check</h1>
      <p class="lead">Чек-лист огляду Volkswagen Golf V перед покупкою. Без діагностики й товщиноміра: очі, руки, вуха.</p>
      <StorageNotice />
      <button class="btn hero-btn" data-action="tab" data-to="/new" @click="switchTab('/new')"><AppIcon name="plus" /><span>Нова перевірка</span></button>
      <div v-if="!hasAny" class="empty">
        <div class="ico"><AppIcon name="clipboard" cls="lg" /></div>
        <h2>Ще немає перевірок</h2>
        <p>Обери мотор, рік і кузов — отримаєш картку моделі з хворобами, ціною і покроковий огляд.</p>
      </div>
      <template v-else>
        <template v-if="active.length"><h2 class="section-h">В процесі</h2><div class="group"><InspRow v-for="i in active" :key="i.id" :i="i" /></div></template>
        <template v-if="done.length"><h2 class="section-h">Завершені</h2><div class="group"><InspRow v-for="i in done" :key="i.id" :i="i" /></div></template>
      </template>
      <InstallCard />
      <BackupCard />
      <p class="foot" style="text-align:center;margin-top:20px">Дані зберігаються лише на цьому телефоні. Резервна копія вбереже огляди, якщо браузер очистить сховище.</p>
    </div>
  </AppScreen>
</template>
