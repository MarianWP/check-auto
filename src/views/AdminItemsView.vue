<script setup>
/* Список власних пунктів чек-листа (включно з вимкненими) з переходом до редагування. */
import { ref, computed, onMounted } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import AdminGate from "../components/AdminGate.vue";
import CL from "../data/checklist.js";
import { isAdmin } from "../cloud/auth";
import { listItems } from "../cloud/admin";
import { SEV_LABEL, modelDef } from "../store";
import { go } from "../nav";

const rows = ref([]);
const loading = ref(true);
const stageName = id => (CL.find(s => s.id === id) || {}).short || id;
const modelName = id => (id ? (modelDef(id) || {}).name || id : "усі моделі");
const groups = computed(() => CL.map(s => ({ stage: s, items: rows.value.filter(r => r.stage === s.id) })).filter(g => g.items.length));
onMounted(async () => { if (isAdmin.value) rows.value = await listItems(); loading.value = false; });
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/admin" back-label="адмінка" title="Власні пункти" kicker="Адмінка · чек-лист" lead="Додаються до вбудованого чек-листа в кінці етапу. Можна обмежити моделлю або тегами двигуна й коробки." />
    <div class="content" :class="enter">
      <AdminGate />
      <div class="btn-stack" style="margin-top: var(--s4)"><button class="btn" data-action="add-item" @click="go('/admin/items/new')"><AppIcon name="plus" /><span>Додати пункт</span></button></div>

      <p v-if="loading" class="foot" style="margin-top: var(--s4)">Завантаження…</p>
      <div v-else-if="!rows.length" class="empty"><h2 class="empty-t">Поки що немає власних пунктів</h2><p class="empty-s">Перший пункт з'явиться у чек-листі всіх користувачів одразу після збереження.</p></div>
      <section v-for="g in groups" :key="g.stage.id" :aria-label="g.stage.name">
        <h2 class="h2">{{ g.stage.name }}</h2>
        <div class="group">
          <button v-for="r in g.items" :key="r.id" class="row" :class="{ 'is-off': !r.enabled }" data-action="edit-item" :data-id="r.id" @click="go('/admin/items/' + r.id)">
            <div class="row-main">
              <div class="row-t">{{ r.title }}</div>
              <div class="row-s">{{ SEV_LABEL[r.sev] }} · {{ modelName(r.model) }}<template v-if="!r.enabled"> · вимкнено</template><template v-if="r.only_tags && r.only_tags.length"> · лише {{ r.only_tags.join(', ') }}</template></div>
            </div>
            <AppIcon name="chev" cls="chev" />
          </button>
        </div>
      </section>
    </div>
  </AppScreen>
</template>
