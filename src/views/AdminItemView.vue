<script setup>
/* Форма власного пункту чек-листа: створення і редагування. */
import { reactive, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import AdminGate from "../components/AdminGate.vue";
import CL from "../data/checklist.js";
import { ENGINE_LIB, GEARBOXES, MODELS } from "../data/index.js";
import { SEVS } from "../logic/content";
import { listItems, saveItem, deleteItem } from "../cloud/admin";
import { SEV_LABEL, sheet } from "../store";
import { back } from "../nav";

const route = useRoute();
const id = route.params.id === "new" ? null : String(route.params.id);
const form = reactive({ model: "", stage: CL[0].id, title: "", how: "", why: "", sev: "major", cost_lo: "", cost_hi: "", tags: "", only_tags: "", sort: 100, enabled: true });
const busy = ref(false);
const loaded = ref(!id);
const TAGS = Array.from(new Set(Object.values(ENGINE_LIB).flatMap(e => e.tags).concat(GEARBOXES.flatMap(g => g.tags)))).sort();

onMounted(async () => {
  if (!id) return;
  const r = (await listItems()).find(x => x.id === id);
  if (r) Object.assign(form, { model: r.model || "", stage: r.stage, title: r.title, how: r.how, why: r.why, sev: r.sev, cost_lo: r.cost_lo ?? "", cost_hi: r.cost_hi ?? "", tags: (r.tags || []).join(", "), only_tags: (r.only_tags || []).join(", "), sort: r.sort, enabled: r.enabled });
  loaded.value = true;
});
async function save() {
  busy.value = true;
  try { if (await saveItem(form, id)) back("/admin/items"); } finally { busy.value = false; }
}
function askDelete() {
  sheet({ title: "Видалити пункт «" + form.title + "»?", text: "Відповіді користувачів на цей пункт лишаться у їхніх оглядах, але сам пункт зникне з чек-листа.", actions: [
    { icon: "trash", label: "Видалити пункт", danger: true, fn: async () => { await deleteItem(id); back("/admin/items"); } }
  ] });
}
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/admin/items" back-label="пункти" :title="id ? 'Редагування пункту' : 'Новий пункт'" />
    <div class="content" :class="enter">
      <div style="margin-top: var(--s4)"><AdminGate /></div>
      <p v-if="!loaded" class="foot" style="margin-top: var(--s4)">Завантаження…</p>
      <form v-else class="fields" style="margin-top: var(--s4)" @submit.prevent="save">
        <label class="field"><span class="field-label">Назва пункту</span><input v-model="form.title" class="input" name="title" maxlength="200" required placeholder="Немає підтікань під помпою"></label>
        <label class="field"><span class="field-label">Як перевірити</span><textarea v-model="form.how" v-autosize class="textarea" name="how" maxlength="1000" required placeholder="Що зробити руками й очима, де дивитися"></textarea></label>
        <label class="field"><span class="field-label">Чому це важливо (необов'язково)</span><textarea v-model="form.why" v-autosize class="textarea" name="why" maxlength="1000" placeholder="Чим загрожує і скільки коштує усунення"></textarea></label>
        <div class="field-row">
          <label class="field"><span class="field-label">Етап</span><select v-model="form.stage" class="input select" name="stage"><option v-for="s in CL" :key="s.id" :value="s.id">{{ s.name }}</option></select></label>
          <label class="field"><span class="field-label">Важливість</span><select v-model="form.sev" class="input select" name="sev"><option v-for="s in SEVS" :key="s" :value="s">{{ SEV_LABEL[s] }}</option></select></label>
        </div>
        <label class="field"><span class="field-label">Модель</span><select v-model="form.model" class="input select" name="model"><option value="">Усі моделі</option><option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.brand }} {{ m.name }}</option></select></label>
        <div class="field-row">
          <label class="field"><span class="field-label">Усунення від, $</span><input v-model="form.cost_lo" class="input" name="cost_lo" inputmode="numeric" placeholder="100"></label>
          <label class="field"><span class="field-label">до, $</span><input v-model="form.cost_hi" class="input" name="cost_hi" inputmode="numeric" placeholder="300"></label>
        </div>
        <label class="field"><span class="field-label">Швидкі теги проблеми через кому (необов'язково)</span><input v-model="form.tags" class="input" name="tags" placeholder="тече, шум, люфт"></label>
        <label class="field"><span class="field-label">Показувати лише для тегів двигуна чи коробки (необов'язково)</span><input v-model="form.only_tags" class="input" name="only_tags" :placeholder="TAGS.slice(0, 6).join(', ')"><span class="hint">Доступні: {{ TAGS.join(', ') }}. Пункт видно, якщо конфігурація має всі перелічені теги.</span></label>
        <div class="field-row">
          <label class="field"><span class="field-label">Порядок серед власних</span><input v-model="form.sort" class="input" name="sort" inputmode="numeric"></label>
          <label class="check"><input v-model="form.enabled" type="checkbox" name="enabled"><span>Увімкнено</span></label>
        </div>
        <button v-if="id" type="button" class="btn ghost danger" data-action="delete-item" @click="askDelete"><AppIcon name="trash" /><span>Видалити пункт</span></button>
      </form>
    </div>
  </AppScreen>

  <div id="bar" class="bar">
    <div class="bar-in">
      <button class="btn" data-action="save-item" :disabled="busy || !loaded" @click="save"><span>{{ busy ? 'Зберігаємо…' : 'Зберегти пункт' }}</span><AppIcon name="check" /></button>
    </div>
  </div>
</template>
