/* Маршрути (hash-режим: працює на GitHub Pages і як Telegram Mini App без серверних правил). */
import { nextTick } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { modelDef, modelApi, DEFAULT_MODEL } from "./data/index.js";
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
import AdminView from "./views/AdminView.vue";
import AdminItemsView from "./views/AdminItemsView.vue";
import AdminItemView from "./views/AdminItemView.vue";
import AdminPhotosView from "./views/AdminPhotosView.vue";
import AssistantView from "./views/AssistantView.vue";
import ProfileView from "./views/ProfileView.vue";
import GenerateView from "./views/GenerateView.vue";

const needInsp = to => insp(String(to.params.id)) ? true : "/";
const needEngine = to => (modelDef(String(to.params.model)) && modelApi(String(to.params.model)).engine(String(to.params.id))) ? true : "/guide";

const routes = [
  { path: "/", name: "home", component: HomeView, meta: { tab: "home" } },
  { path: "/new", name: "new", component: NewCheckView, meta: { tab: "new" } },
  { path: "/guide", name: "guide", component: GuideView, meta: { tab: "guide" } },
  { path: "/assistant", name: "assistant", component: AssistantView, meta: { tab: "assistant" } },
  { path: "/profile", name: "profile", component: ProfileView, meta: { back: "/" } },
  { path: "/generate", name: "generate", component: GenerateView, meta: { back: "/new" } },
  { path: "/guide/:model/:id", name: "engine", component: EngineView, meta: { tab: "guide", back: "/guide" }, beforeEnter: needEngine },
  /* Старі посилання без моделі — Golf V. */
  { path: "/guide/:id", redirect: to => "/guide/" + DEFAULT_MODEL + "/" + to.params.id },
  { path: "/car/:id", name: "car", component: CarView, meta: { bar: true, back: "/" }, beforeEnter: needInsp },
  { path: "/check/:id/:n?", name: "check", component: CheckView, meta: { bar: true }, beforeEnter: needInsp },
  { path: "/report/:id", name: "report", component: ReportView, meta: { tab: "home", back: "/" }, beforeEnter: needInsp },
  { path: "/admin", name: "admin", component: AdminView, meta: { back: "/" } },
  { path: "/admin/items", name: "admin-items", component: AdminItemsView, meta: { back: "/admin" } },
  { path: "/admin/items/:id", name: "admin-item", component: AdminItemView, meta: { back: "/admin/items", bar: true } },
  { path: "/admin/photos", name: "admin-photos", component: AdminPhotosView, meta: { back: "/admin" } },
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
