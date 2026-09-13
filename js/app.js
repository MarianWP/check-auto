/* Golf Check — маршрути (vue-router, hash-режим), навігація, глобальні дії, монтування. */
(function (GC) {
  "use strict";
  const { createApp, nextTick } = Vue;
  const { createRouter, createWebHashHistory } = VueRouter;
  const G = window.GOLF, TG = window.TG, V = GC.views;

  /* ---------- Навігація: напрямок анімації входу, глибина для «Назад», позиції скролу ---------- */
  GC.nav = { dir: "", depth: 0, scroll: Object.create(null) };

  const needInsp = to => GC.insp(String(to.params.id)) ? true : "/";
  const routes = [
    { path: "/", name: "home", component: V.Home, meta: { tab: "home" } },
    { path: "/new", name: "new", component: V.NewCheck, meta: { tab: "new" } },
    { path: "/guide", name: "guide", component: V.Guide, meta: { tab: "guide" } },
    { path: "/guide/:id", name: "engine", component: V.Engine, meta: { tab: "guide", back: "/guide" }, beforeEnter: to => G.engine(String(to.params.id)) ? true : "/guide" },
    { path: "/car/:id", name: "car", component: V.Car, meta: { bar: true, back: "/" }, beforeEnter: needInsp },
    { path: "/check/:id/:n?", name: "check", component: V.Check, meta: { bar: true }, beforeEnter: needInsp },
    { path: "/report/:id", name: "report", component: V.Report, meta: { tab: "home", back: "/" }, beforeEnter: needInsp },
    /* Невідомий шлях (зокрема параметри запуску Telegram у hash) показує дім, не змінюючи адресу,
       щоб SDK Telegram встиг прочитати їх із hash. */
    { path: "/:pathMatch(.*)*", name: "fallback", component: V.Home, meta: { tab: "home" } }
  ];
  const router = createRouter({ history: createWebHashHistory(), routes });
  GC.router = router;

  const backOf = r => r.meta.back || (r.name === "check" ? "/car/" + r.params.id : null);
  const scroller = () => document.querySelector(".screen");

  GC.go = to => {
    if (router.currentRoute.value.fullPath === to) return;
    GC.nav.dir = "fwd"; GC.nav.depth++;
    router.push(to);
  };
  GC.back = fallback => {
    GC.nav.dir = "back";
    if (GC.nav.depth > 0) { GC.nav.depth--; router.back(); }
    else router.replace(fallback || "/");
  };
  /* Вкладки не пишуть історію; повторний тап на активній — скрол угору. */
  GC.switchTab = to => {
    if (router.currentRoute.value.path === to) {
      const s = scroller(); if (s) s.scrollTo({ top: 0, behavior: GC.reduced() ? "auto" : "smooth" });
      return;
    }
    TG.haptic("select");
    GC.nav.dir = "tab";
    router.replace(to);
  };
  router.beforeEach((to, from) => {
    const s = scroller();
    if (s && from.fullPath) GC.nav.scroll[from.fullPath] = s.scrollTop;
  });
  router.afterEach(to => {
    const b = backOf(to);
    TG.setBack(b ? () => GC.back(b) : null);
    nextTick(() => { GC.nav.dir = "fwd"; });
  });

  /* ---------- Глобальні дії: меню перевірки, перейменування, видалення, поділитися ---------- */
  GC.menu = id => {
    const i = GC.insp(id); if (!i) return;
    GC.sheet({ title: i.name || G.label(i.cfg), actions: [
      { icon: "car", label: "Картка моделі", fn: () => GC.go("/car/" + id) },
      { icon: "clipboard", label: "Чек-лист", fn: () => GC.go("/check/" + id + "/" + (i.stage || 0)) },
      { icon: "share", label: "Звіт", fn: () => GC.go("/report/" + id) },
      { label: "Перейменувати", fn: () => GC.renameSheet(id) },
      { icon: "trash", label: "Видалити", danger: true, fn: () => GC.confirmDelete(id) }
    ] });
  };
  GC.renameSheet = id => {
    const i = GC.insp(id); if (!i) return;
    GC.sheet({ title: "Назва перевірки", input: { value: i.name || "", placeholder: G.label(i.cfg) }, actions: [
      { label: "Зберегти", fn: v => GC.rename(i, v) }
    ] });
  };
  GC.confirmDelete = id => {
    const i = GC.insp(id); if (!i) return;
    GC.sheet({ title: "Видалити перевірку «" + (i.name || G.label(i.cfg)) + "»? Це незворотно.", actions: [
      { label: "Видалити", danger: true, fn: () => {
        GC.remove(id);
        const r = router.currentRoute.value;
        if (r.params && r.params.id === id) { GC.nav.dir = "back"; router.replace("/"); }
        GC.toast("Перевірку видалено");
      } }
    ] });
  };
  GC.share = async id => {
    const i = GC.insp(id); if (!i) return;
    const text = GC.reportText(i);
    if (TG.active) {
      GC.sheet({ title: "Поділитися звітом", actions: [
        { icon: "share", label: "Надіслати в Telegram", fn: () => TG.share(text) },
        { label: "Скопіювати текст", fn: () => GC.copy(text) }
      ] });
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: "Golf Check — звіт", text }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    GC.copy(text);
  };
  GC.copy = async text => {
    try { await navigator.clipboard.writeText(text); GC.toast("Звіт скопійовано"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); GC.toast("Звіт скопійовано"); } catch (e2) { GC.toast("Не вдалося скопіювати"); }
      ta.remove();
    }
  };

  /* ---------- Монтування ---------- */
  const app = createApp({
    template: `<router-view :key="$route.fullPath"></router-view><TabBar v-if="$route.meta.tab"></TabBar><SheetHost></SheetHost><ToastHost></ToastHost>`
  });
  app.use(router);
  app.config.globalProperties.$gc = GC;
  Object.entries(GC.components).forEach(([name, c]) => app.component(name, c));
  Object.entries(GC.directives).forEach(([name, d]) => app.directive(name, d));
  app.mount("#app");

  /* Зовнішні посилання у Telegram відкриваємо через SDK. */
  document.getElementById("app").addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (a && TG.active && /^https?:/i.test(a.href) && TG.openLink(a.href)) e.preventDefault();
  });
  window.addEventListener("pageshow", ev => { if (ev.persisted) GC.reload(); });
  /* Після старту SDK Telegram hash запуску вже прибрано — вирівнюємо роутер. */
  TG.onReady(() => { if (/tgWebApp/.test(router.currentRoute.value.path) || /tgWebApp/.test(location.hash)) router.replace("/"); });
})(window.GC);
