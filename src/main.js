/* Golf Check — точка входу: застосунок, роутер, директиви, service worker, хуки Telegram. */
import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import router from "./router";
import TG from "./tg";
import { reload } from "./store";
import { autosize } from "./directives";
import "./assets/app.css";

const app = createApp(App);
app.use(router);
app.directive("autosize", autosize);
app.mount("#app");

/* Для відлагодження в консолі та тестів. */
window.TG = TG;

/* Зовнішні посилання у Telegram відкриваємо через SDK. */
document.getElementById("app").addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (a && TG.active && /^https?:/i.test(a.href) && TG.openLink(a.href)) e.preventDefault();
});
window.addEventListener("pageshow", ev => { if (ev.persisted) reload(); });
/* Після старту SDK Telegram hash запуску вже прибрано — вирівнюємо роутер. */
TG.onReady(() => {
  if (/tgWebApp/.test(router.currentRoute.value.path) || /tgWebApp/.test(location.hash)) router.replace("/");
});

registerSW({ immediate: true });
