/* Golf Check — каркас інтерфейсу: іконка, екран-скролер, шапка, таб-бар, чипи, аркуш дій, тост. */
window.GC = window.GC || {};
(function (GC) {
  "use strict";
  const { reactive, ref, computed, provide, inject, onMounted, onBeforeUnmount, nextTick, watch } = Vue;
  const { useRoute } = VueRouter;
  const ICONS = window.LUCIDE || {};
  const C = GC.components = GC.components || {};

  C.Icon = {
    props: { name: { type: String, required: true }, cls: String },
    computed: { p() { return ICONS[this.name] || ""; } },
    template: `<svg class="i" :class="cls" viewBox="0 0 24 24" aria-hidden="true" v-html="p"></svg>`
  };

  C.Dots = {
    props: { r: Number },
    template: `<span class="dots" :class="'r' + r" :aria-label="'Надійність ' + r + ' з 5'"><i v-for="k in 5" :key="k" :class="{ on: k <= r }"></i></span>`
  };

  /* Екран — єдиний скролер застосунку. Слот отримує клас анімації входу (ставиться лише на .content),
     шапка отримує стан скролу через inject. Скролер сам ніколи не анімується. */
  C.Screen = {
    setup() {
      const route = useRoute();
      const el = ref(null);
      const state = reactive({ scrolled: false, titled: false });
      provide("scrollState", state);
      const dir = GC.nav.dir;
      const enter = dir === "back" ? "enter-back" : dir === "tab" ? "enter-tab" : dir === "fwd" ? "enter-fwd" : "";
      const hasBar = !!route.meta.bar, hasTabs = !hasBar && !!route.meta.tab;
      function onScroll() {
        const s = el.value; if (!s) return;
        state.scrolled = s.scrollTop > 4;
        state.titled = s.scrollTop > 44;
      }
      onMounted(() => {
        const y = dir === "back" ? GC.nav.scroll[route.fullPath] : 0;
        if (y && el.value) el.value.scrollTop = y;
        onScroll();
      });
      return { el, enter, hasBar, hasTabs, onScroll };
    },
    template: `<div class="screen" :class="{ 'has-bar': hasBar, 'has-tabs': hasTabs }" ref="el" @scroll.passive="onScroll"><slot :enter="enter"></slot></div>`
  };

  C.NavBar = {
    props: { back: String, backLabel: String, title: String, sub: String, titleOnScroll: Boolean },
    setup() {
      const s = inject("scrollState", reactive({ scrolled: false, titled: false }));
      return { s };
    },
    template: `<header class="nav" id="nav" :class="{ scrolled: s.scrolled, titled: s.titled }">
  <div class="nav-row">
    <div><button v-if="back" class="nav-btn" data-action="back" :data-to="back" @click="$gc.back(back)" aria-label="Назад"><Icon name="back"/><span>{{ backLabel || 'Назад' }}</span></button></div>
    <div class="nav-title" :class="{ stacked: !!sub, 'on-scroll': titleOnScroll }">{{ title }}<span v-if="sub" class="nav-sub">{{ sub }}</span></div>
    <div><slot name="right"></slot></div>
  </div>
  <slot name="extra"></slot>
</header>`
  };

  C.TabBar = {
    setup() {
      const route = useRoute();
      const tabs = [
        { id: "home", to: "/", label: "Перевірки", icon: "clipboard" },
        { id: "new", to: "/new", label: "Нова", icon: "circlePlus" },
        { id: "guide", to: "/guide", label: "Довідник", icon: "book" }
      ];
      const active = computed(() => route.meta.tab);
      return { tabs, active };
    },
    template: `<nav class="tabs" id="tabs" aria-label="Розділи"><div class="tabs-in">
  <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: active === t.id }" :data-tab="t.id" :data-to="t.to" :aria-current="active === t.id ? 'page' : null" @click="$gc.switchTab(t.to)"><Icon :name="t.icon"/><span>{{ t.label }}</span></button>
</div></nav>`
  };

  C.Chips = {
    props: { list: Array, sel: [String, Number], k: String },
    emits: ["pick"],
    template: `<div class="chips"><button v-for="o in list" :key="o.id" class="chip" :class="{ on: sel === o.id }" data-action="draft" :data-k="k" :data-v="o.id" :aria-pressed="sel === o.id" @click="$emit('pick', k, o.id)">{{ o.name }}</button></div>`
  };

  C.SheetHost = {
    setup() {
      const ui = GC.ui;
      const input = ref(null);
      const value = ref("");
      function close() { GC.closeSheet(); }
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
      return { ui, input, value, close, run };
    },
    template: `<transition name="scrim"><div v-if="ui.sheet" class="scrim" @click="close"></div></transition>
<transition name="sheet"><div v-if="ui.sheet" class="sheet" role="dialog" aria-modal="true"><div class="sheet-in">
  <div class="sheet-group">
    <div v-if="ui.sheet.title" class="sheet-title">{{ ui.sheet.title }}</div>
    <div v-if="ui.sheet.input" class="sheet-field"><input ref="input" class="input" v-model="value" :placeholder="ui.sheet.input.placeholder || ''" maxlength="60" autocomplete="off" enterkeyhint="done" @keydown.enter.prevent="run(0)"></div>
    <button v-for="(a, k) in ui.sheet.actions" :key="k" class="sheet-btn" :class="{ danger: a.danger }" :data-k="k" @click="run(k)"><Icon v-if="a.icon" :name="a.icon"/><span>{{ a.label }}</span></button>
  </div>
  <div class="sheet-group"><button class="sheet-btn cancel" data-k="-1" @click="close">Скасувати</button></div>
</div></div></transition>`
  };

  C.ToastHost = {
    setup() { const route = useRoute(); return { ui: GC.ui, route }; },
    template: `<transition name="toast"><div v-if="ui.toast" :key="ui.toast.id" class="toast" :class="{ 'above-bar': route.meta.bar, 'above-tabs': !route.meta.bar && route.meta.tab }" role="status">{{ ui.toast.msg }}</div></transition>`
  };

  /* v-autosize для textarea: висота під текст. */
  const fit = el => { el.style.height = "auto"; el.style.height = Math.max(48, el.scrollHeight) + "px"; };
  GC.directives = { autosize: { mounted: fit, updated: fit } };
})(window.GC);
