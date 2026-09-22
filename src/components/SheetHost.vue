<script setup>
/* Аркуш: меню дій і діалоги (підтвердження, поле вводу). Керується через store.ui.sheet:
   { title, text?, input?: { label, value, placeholder }, actions: [{ label, icon?, danger?, primary?, fn }] }
   Доступність: role=dialog, фокус переходить в аркуш, Tab ходить по колу, Esc закриває,
   після закриття фокус повертається на елемент, що відкрив аркуш. */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import AppIcon from "./AppIcon.vue";
import { ui, closeSheet } from "../store";

const panel = ref(null);
const input = ref(null);
const value = ref("");
let opener = null;

const focusables = () => panel.value ? Array.from(panel.value.querySelectorAll("button, input, [href], [tabindex]:not([tabindex='-1'])")).filter(el => !el.disabled) : [];

function close() { closeSheet(); }
function run(k) {
  const o = ui.sheet; if (!o) return;
  const v = o.input ? value.value : undefined;
  close();
  const a = o.actions[k];
  if (a && a.fn) setTimeout(() => a.fn(v), 40);
}
function onKeydown(e) {
  if (!ui.sheet) return;
  if (e.key === "Escape") { e.preventDefault(); close(); return; }
  if (e.key !== "Tab") return;
  const list = focusables(); if (!list.length) return;
  const first = list[0], last = list[list.length - 1], cur = document.activeElement;
  if (e.shiftKey && (cur === first || !panel.value.contains(cur))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (cur === last || !panel.value.contains(cur))) { e.preventDefault(); first.focus(); }
}
onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));

watch(() => ui.sheet, (o, prev) => {
  if (o && !prev) opener = document.activeElement;
  if (o) {
    value.value = o.input ? (o.input.value || "") : "";
    nextTick(() => {
      const target = o.input ? input.value : focusables()[0];
      try { if (target) { target.focus({ preventScroll: true }); if (o.input) target.select(); } } catch (e) { /* iOS без жесту */ }
    });
  } else if (prev) {
    const back = opener; opener = null;
    /* Якщо дія аркуша відкриє наступний аркуш, фокус забере він; інакше повертаємо туди, звідки прийшли. */
    setTimeout(() => { if (!ui.sheet && back && back.isConnected && typeof back.focus === "function") back.focus({ preventScroll: true }); }, 60);
  }
});
</script>

<template>
  <transition name="scrim"><div v-if="ui.sheet" class="scrim" @click="close"></div></transition>
  <transition name="sheet">
    <div v-if="ui.sheet" class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div ref="panel" class="sheet-in">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 id="sheet-title" class="sheet-title">{{ ui.sheet.title }}</h2>
        <p v-if="ui.sheet.text" class="sheet-text">{{ ui.sheet.text }}</p>
        <label v-if="ui.sheet.input" class="field sheet-field">
          <span class="field-label">{{ ui.sheet.input.label }}</span>
          <input ref="input" v-model="value" class="input" :placeholder="ui.sheet.input.placeholder || ''" maxlength="60" autocomplete="off" enterkeyhint="done" @keydown.enter.prevent="run(0)">
        </label>
        <div class="sheet-list">
          <template v-for="(a, k) in ui.sheet.actions" :key="k">
            <button v-if="a.primary" class="btn" :data-k="k" @click="run(k)"><AppIcon v-if="a.icon" :name="a.icon" /><span>{{ a.label }}</span></button>
            <!-- Варіант вибору (on задано): рядок з перемикачем праворуч, обраний виділено; звичайна дія — як була. -->
            <button v-else-if="a.on !== undefined" class="sheet-btn choice" :class="{ on: a.on }" :data-k="k" role="radio" :aria-checked="a.on" @click="run(k)"><AppIcon v-if="a.icon" :name="a.icon" /><span class="sheet-main"><span>{{ a.label }}</span><span v-if="a.sub" class="sheet-sub">{{ a.sub }}</span></span><span class="sheet-radio" aria-hidden="true"><AppIcon v-if="a.on" name="check" /></span></button>
            <button v-else class="sheet-btn" :class="{ danger: a.danger }" :data-k="k" @click="run(k)"><AppIcon v-if="a.icon" :name="a.icon" /><span>{{ a.label }}</span></button>
          </template>
        </div>
        <button class="btn tonal" data-k="-1" @click="close">Скасувати</button>
      </div>
    </div>
  </transition>
</template>
