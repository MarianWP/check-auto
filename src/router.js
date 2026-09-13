/* Маршрути (hash-режим: працює на GitHub Pages і як Telegram Mini App без серверних правил). */
import { nextTick } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import G from "./data/golf";
import TG from "./tg";
import { insp } from "./store";
import { nav, setRouter, scroller, back } from "./nav";
import HomeView from "./views/HomeView.vue";
import NewCheckView from "./views/NewCheckView.vue";
import GuideView from "./views/GuideView.vue";
import EngineView from "./views/EngineView.vue";
import CarView from "./views/CarView.vue";
import CheckView from "./views/CheckView.vue";
import ReportView from "./views/ReportView.vue";

const needInsp = to => insp(String(to.params.id)) ? true : "/";

const routes = [
  { path: "/", name: "home", component: HomeView, meta: { tab: "home" } },
  { path: "/new", name: "new", component: NewCheckView, meta: { tab: "new" } },
  { path: "/guide", name: "guide", component: GuideView, meta: { tab: "guide" } },
  { path: "/guide/:id", name: "engine", component: EngineView, meta: { tab: "guide", back: "/guide" }, beforeEnter: to => G.engine(String(to.params.id)) ? true : "/guide" },
  { path: "/car/:id", name: "car", component: CarView, meta: { bar: true, back: "/" }, beforeEnter: needInsp },
  { path: "/check/:id/:n?", name: "check", component: CheckView, meta: { bar: true }, beforeEnter: needInsp },
  { path: "/report/:id", name: "report", component: ReportView, meta: { tab: "home", back: "/" }, beforeEnter: needInsp },
  /* Невідомий шлях (зокрема параметри запуску Telegram у hash) показує дім, не змінюючи адресу,
     щоб SDK Telegram встиг прочитати їх із hash. */
  { path: "/:pathMatch(.*)*", name: "fallback", component: HomeView, meta: { tab: "home" } }
];

const router = createRouter({ history: createWebHashHistory(), routes });
setRouter(router);

export const backOf = r => r.meta.back || (r.name === "check" ? "/car/" + r.params.id : null);

router.beforeEach((to, from) => {
  const s = scroller();
  if (s && from.fullPath) nav.scroll[from.fullPath] = s.scrollTop;
});
router.afterEach(to => {
  const b = backOf(to);
  TG.setBack(b ? () => back(b) : null);
  nextTick(() => { nav.dir = "fwd"; });
});

export default router;
