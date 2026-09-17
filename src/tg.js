/* Golf Check — інтеграція з Telegram Mini App.
   SDK підвантажується з index.html лише коли апку відкрито з Telegram.
   Поза Telegram модуль існує, але всі методи — безпечні заглушки. */
import { reactive } from "vue";

/* Реактивний стан для інтерфейсу: active — апка працює всередині Telegram;
   nativeBack — Telegram показує власну кнопку «Назад», тож нашу в шапці ховаємо. */
export const tgState = reactive({ active: false, nativeBack: false });

const TG = (function () {
  "use strict";
  var api = { active: false, tg: null };
  var backFn = null, fired = false, queue = [];
  /* Єдина темна тема: кольори шапки, підкладки і нижньої смуги Telegram завжди збігаються з фоном апки. */
  var BG = "#101112";

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function v(ver) { return safe(function () { return !!(api.tg && api.tg.isVersionAtLeast(ver)); }) === true; }

  /* Тема Telegram (світла чи темна) на палітру не впливає: лише фарбуємо рамку Telegram у наш фон.
     Викликаємо і на themeChanged, бо Telegram після зміни теми повертає свої кольори. */
  function applyTheme() {
    var tg = api.tg;
    if (v("6.1")) {
      safe(function () { tg.setBackgroundColor(BG); });
      safe(function () { tg.setHeaderColor(v("6.9") ? BG : "bg_color"); });
    }
    if (v("7.10")) safe(function () { tg.setBottomBarColor(BG); });
  }

  /* Безпечні зони: у повноекранному режимі Telegram малює свої кнопки (закрити, меню) поверх контенту,
     тому шапку опускаємо на відступ пристрою (статус-бар) + відступ контенту (смуга з кнопками Telegram, Bot API 8.0+)
     + невеликий запас. Якщо клієнт у повному екрані не повідомив відступи — беремо типові. */
  var FULL_STATUS_MIN = 44, FULL_CONTENT_MIN = 46, FULL_EXTRA = 8;
  function applyInsets() {
    var tg = api.tg, s = tg.safeAreaInset, c = tg.contentSafeAreaInset;
    if (!s && !c) return;
    var st = document.documentElement.style;
    var g = function (o, k) { return (o && o[k]) || 0; };
    var full = !!tg.isFullscreen, sTop = g(s, "top"), cTop = g(c, "top");
    if (full && sTop < 20) sTop = FULL_STATUS_MIN;
    if (full && cTop < 30) cTop = FULL_CONTENT_MIN;
    st.setProperty("--sat", (sTop + cTop + (full ? FULL_EXTRA : 0)) + "px");
    st.setProperty("--sab", (g(s, "bottom") + g(c, "bottom")) + "px");
    st.setProperty("--sal", (g(s, "left") + g(c, "left")) + "px");
    st.setProperty("--sar", (g(s, "right") + g(c, "right")) + "px");
  }

  function init() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || api.active) return;
    if (!(tg.initData || (tg.platform && tg.platform !== "unknown"))) return;
    api.tg = tg; api.active = true;
    tgState.active = true;
    tgState.nativeBack = v("6.1") && !!tg.BackButton;
    document.documentElement.dataset.tg = "1";

    safe(function () { tg.expand(); });
    if (v("7.7")) safe(function () { tg.disableVerticalSwipes(); });
    if (v("8.0") && /^(ios|android|android_x)$/.test(tg.platform) && !tg.isFullscreen) safe(function () { tg.requestFullscreen(); });

    applyTheme();
    safe(function () { tg.onEvent("themeChanged", applyTheme); });
    applyInsets();
    ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged", "viewportChanged"].forEach(function (ev) {
      safe(function () { tg.onEvent(ev, applyInsets); });
    });
    if (v("6.1") && tg.BackButton) safe(function () { tg.BackButton.onClick(function () { if (backFn) backFn(); }); });

    /* Telegram передає параметри запуску у hash, а наш роутер живе там само. SDK їх уже прочитав — прибираємо. */
    if (/tgWebApp/.test(location.hash)) safe(function () { history.replaceState(history.state, "", location.pathname + location.search + "#/"); });

    setTimeout(function () {
      fired = true;
      queue.splice(0).forEach(safe);
      api.setBack(backFn);
      safe(function () { tg.ready(); });
    }, 0);
  }

  api.onReady = function (fn) { if (fired) safe(fn); else queue.push(fn); };
  api.setBack = function (fn) {
    backFn = fn;
    if (!api.active || !v("6.1") || !api.tg.BackButton) return;
    safe(function () { if (fn) api.tg.BackButton.show(); else api.tg.BackButton.hide(); });
  };
  api.haptic = function (type) {
    if (!api.active || !v("6.1") || !api.tg.HapticFeedback) return;
    safe(function () {
      if (type === "select") api.tg.HapticFeedback.selectionChanged();
      else api.tg.HapticFeedback.impactOccurred(type || "light");
    });
  };
  api.openLink = function (url) {
    if (!api.active) return false;
    return safe(function () { api.tg.openLink(url); return true; }) === true;
  };
  api.share = function (text) {
    var url = location.origin + location.pathname;
    var link = "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(text);
    if (api.active && v("6.1")) safe(function () { api.tg.openTelegramLink(link); });
    else window.open(link, "_blank");
  };

  if (window.Telegram && window.Telegram.WebApp) init();
  else window.addEventListener("tg-sdk", init);
  return api;
})();
export default TG;
