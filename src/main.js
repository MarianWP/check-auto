/* Golf Check — точка входу: застосунок, роутер, директиви, service worker, хмара, хуки Telegram. */
import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import router from "./router";
import TG from "./tg";
import { reload, flush, probeStorage } from "./store";
import { autosize } from "./directives";
import { isExternalUrl } from "./logic/links";
import { initKeyboard } from "./keyboard";
import { initContent } from "./cloud/content";
import { initAuth } from "./cloud/auth";
import { initSync } from "./cloud/sync";
import "./assets/styles/index.css";

const app = createApp(App);
app.use(router);
app.directive("autosize", autosize);
app.mount("#app");

/* Для відлагодження в консолі та тестів. */
window.TG = TG;

/* У Telegram зовнішні посилання відкриваємо через SDK. Саме зовнішні: інший origin або target=_blank.
   Внутрішні (#/guide, #/new — пункти нижньої навігації) лишаються роутеру, інакше вони відкривали б сайт у браузері. */
document.getElementById("app").addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a || !TG.active) return;
  const external = isExternalUrl(a.href, location.href) || (a.target === "_blank" && /^https?:/i.test(a.href));
  if (external && TG.openLink(a.href)) e.preventDefault();
});
window.addEventListener("pageshow", ev => { if (ev.persisted) reload(); });
/* Сховище: перевіряємо запис одразу і не чекаємо таймера, коли апку згортають чи закривають. */
probeStorage();
initKeyboard();
/* Збільшений текст (типовий розмір шрифту браузера або Dynamic Type на iOS): позначаємо клас, щоб вкладки стали у стовпчик. */
function markTextScale() {
  const base = window.CSS && CSS.supports("-webkit-touch-callout", "none") ? 17 : 16;
  const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || base;
  document.documentElement.classList.toggle("big-text", fs / base > 1.12);
}
markTextScale();
window.addEventListener("resize", markTextScale);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") markTextScale(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
window.addEventListener("pagehide", flush);
/* Після старту SDK Telegram hash запуску вже прибрано — вирівнюємо роутер. */
TG.onReady(() => {
  if (/tgWebApp/.test(router.currentRoute.value.path) || /tgWebApp/.test(location.hash)) router.replace("/");
});

/* Хмара (лише коли задано ключі Supabase): контент з адмінки, вхід через Telegram, синхронізація оглядів. */
/* Хмара не має права зламати локальну роботу: будь-яка помилка ініціалізації лише в консоль. */
for (const init of [initContent, initAuth, initSync]) { try { init(); } catch (e) { console.error("[cloud] " + (e && e.message ? e.message : e)); } }

registerSW({ immediate: true });
