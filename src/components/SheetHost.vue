<script setup>
/* Аркуш дій (action sheet): список дій, необов'язкове поле вводу. Керується через store.ui.sheet. */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import AppIcon from "./AppIcon.vue";
import { ui, closeSheet } from "../store";

const input = ref(null);
const value = ref("");

function close() { closeSheet(); }
function run(k) {
  const o = ui.sheet; if (!o) return;
  const v = o.input ? value.value : undefined;
  close();
  const a = o.actions[k];
  if (a && a.fn) setTimeout(() => a.fn(v), 40);
}
function onKey(e) { if (e.key === "Escape" && ui.sheet) close(); }
onMounted(() => document.addEventListener("keydown", onKey));
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
watch(() => ui.sheet, o => {
  if (!o || !o.input) return;
  value.value = o.input.value || "";
  nextTick(() => setTimeout(() => { try { if (input.value) { input.value.focus(); input.value.select(); } } catch (e) { /* iOS без жесту */ } }, 60));
});
</script>

<template>
  <transition name="scrim"><div v-if="ui.sheet" class="scrim" @click="close"></div></transition>
  <transition name="sheet">
    <div v-if="ui.sheet" class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-in">
        <div class="sheet-group">
          <div v-if="ui.sheet.title" class="sheet-title">{{ ui.sheet.title }}</div>
          <div v-if="ui.sheet.input" class="sheet-field">
            <input ref="input" v-model="value" class="input" :placeholder="ui.sheet.input.placeholder || ''" maxlength="60" autocomplete="off" enterkeyhint="done" @keydown.enter.prevent="run(0)">
          </div>
          <button v-for="(a, k) in ui.sheet.actions" :key="k" class="sheet-btn" :class="{ danger: a.danger }" :data-k="k" @click="run(k)">
            <AppIcon v-if="a.icon" :name="a.icon" /><span>{{ a.label }}</span>
          </button>
        </div>
        <div class="sheet-group"><button class="sheet-btn cancel" data-k="-1" @click="close">Скасувати</button></div>
      </div>
    </div>
  </transition>
</template>
