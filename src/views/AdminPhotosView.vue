<script setup>
/* Фото до проблем: обрати, до чого прив'язати (двигун, коробка, спільна хвороба моделі або пункт чек-листа),
   завантажити з телефона, підписати, видалити. Фото стискаються до 1600 px перед відправкою. */
import { reactive, ref, computed } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import SecTitle from "../components/SecTitle.vue";
import PhotoStrip from "../components/PhotoStrip.vue";
import AdminGate from "../components/AdminGate.vue";
import CL from "../data/checklist.js";
import { MODELS, modelApi, ENGINE_LIB, GEARBOXES } from "../data/index.js";
import { photosFor } from "../cloud/content";
import { uploadPhoto, updateCaption, deletePhoto } from "../cloud/admin";
import { extraItems, sheet, toast } from "../store";

const KINDS = [{ id: "engine", name: "Проблема двигуна" }, { id: "gearbox", name: "Проблема коробки" }, { id: "common", name: "Спільна хвороба моделі" }, { id: "item", name: "Пункт чек-листа" }];
const f = reactive({ kind: "engine", model: MODELS[0].id, target: Object.keys(ENGINE_LIB)[0], idx: 0, caption: "" });
const busy = ref(false);

const targets = computed(() => {
  if (f.kind === "engine") return Object.entries(ENGINE_LIB).map(([id, e]) => ({ id, name: e.name }));
  if (f.kind === "gearbox") return GEARBOXES.map(g => ({ id: g.id, name: g.name }));
  if (f.kind === "common") return [{ id: f.model, name: (modelApi(f.model).model.name) }];
  const own = extraItems.list.map(it => ({ id: it.id, name: "(власний) " + it.t }));
  return CL.flatMap(s => s.items.map(it => ({ id: it.id, name: s.short + ": " + it.t }))).concat(own);
});
const issues = computed(() => {
  if (f.kind === "engine") return (ENGINE_LIB[f.target] || { issues: [] }).issues;
  if (f.kind === "gearbox") return (GEARBOXES.find(g => g.id === f.target) || { issues: [] }).issues;
  if (f.kind === "common") return modelApi(f.model).COMMON;
  return [];
});
function onKind() { f.target = targets.value[0] ? targets.value[0].id : ""; f.idx = 0; }
function onModel() { if (f.kind === "common") f.target = f.model; f.idx = 0; }
const photoModel = computed(() => (f.kind === "common" ? f.model : null));
const photos = computed(() => photosFor(f.kind, f.target, f.idx, photoModel.value));
const targetName = computed(() => (targets.value.find(t => t.id === f.target) || {}).name || "");

async function onFile(ev) {
  const input = ev.target, file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  busy.value = true;
  try { await uploadPhoto(file, { kind: f.kind, target: f.target, idx: f.kind === "item" ? 0 : f.idx, model: photoModel.value, caption: f.caption }); f.caption = ""; }
  catch (e) { /* тост уже показано */ }
  finally { busy.value = false; }
}
function editCaption(p) {
  sheet({ title: "Підпис до фото", input: { label: "Підпис", value: p.caption, placeholder: "Що саме на фото" }, actions: [{ label: "Зберегти", primary: true, fn: v => updateCaption(p.id, v) }] });
}
function askDelete(p) {
  sheet({ title: "Видалити фото?", text: p.caption || "Без підпису", actions: [{ icon: "trash", label: "Видалити фото", danger: true, fn: () => deletePhoto(p) }] });
}
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/admin" back-label="адмінка" title="Фото до проблем" kicker="Адмінка · фото" lead="Покажи, як виглядає хвороба або що саме перевіряти. Фото бачать усі користувачі в довіднику, картці авто і чек-листі." />
    <div class="content" :class="enter">
      <AdminGate />

      <div class="card fields" style="margin-top: var(--s4)">
        <label class="field"><span class="field-label">До чого прив'язати</span><select v-model="f.kind" class="input select" @change="onKind"><option v-for="k in KINDS" :key="k.id" :value="k.id">{{ k.name }}</option></select></label>
        <label v-if="f.kind === 'common'" class="field"><span class="field-label">Модель</span><select v-model="f.model" class="input select" @change="onModel"><option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.brand }} {{ m.name }}</option></select></label>
        <label v-if="f.kind !== 'common'" class="field"><span class="field-label">{{ f.kind === 'item' ? 'Пункт' : (f.kind === 'engine' ? 'Двигун' : 'Коробка') }}</span><select v-model="f.target" class="input select" @change="f.idx = 0"><option v-for="t in targets" :key="t.id" :value="t.id">{{ t.name }}</option></select></label>
        <label v-if="issues.length" class="field"><span class="field-label">Проблема</span><select v-model="f.idx" class="input select"><option v-for="(x, k) in issues" :key="k" :value="k">{{ x.t }}</option></select></label>
      </div>

      <section aria-labelledby="h-cur">
        <SecTitle id="h-cur" icon="image">{{ f.kind === 'item' ? targetName : (issues[f.idx] ? issues[f.idx].t : targetName) }}</SecTitle>
        <div class="card fields">
          <PhotoStrip :photos="photos" />
          <p v-if="!photos.length" class="foot">Фото ще немає.</p>
          <div v-for="p in photos" :key="p.id" class="photo-row">
            <span class="row-main">{{ p.caption || 'Без підпису' }}</span>
            <button class="icon-btn tonal" :aria-label="'Підпис до фото ' + (p.caption || '')" @click="editCaption(p)"><AppIcon name="pencil" /></button>
            <button class="icon-btn tonal" :aria-label="'Видалити фото ' + (p.caption || '')" @click="askDelete(p)"><AppIcon name="trash" /></button>
          </div>
          <label class="field"><span class="field-label">Підпис до нового фото (необов'язково)</span><input v-model="f.caption" class="input" maxlength="200" placeholder="Іржа під ущільнювачем скла багажника"></label>
          <label class="btn" :class="{ tonal: busy }">
            <AppIcon name="upload" /><span>{{ busy ? 'Завантажуємо…' : 'Додати фото' }}</span>
            <input class="visually-hidden" type="file" accept="image/*" :disabled="busy" @change="onFile">
          </label>
        </div>
      </section>
    </div>
  </AppScreen>
</template>
