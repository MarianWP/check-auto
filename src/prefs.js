/* Налаштування користувача: реактивний стан, збереження і застосування теми до документа й рамки Telegram. */
import { reactive, watch } from "vue";
import { PREFS_KEY, parsePrefs, resolveTheme, THEME_BG } from "./logic/prefs";
import TG from "./tg";

const read = () => { try { return localStorage.getItem(PREFS_KEY); } catch (e) { return null; } };
export const prefs = reactive(parsePrefs(read()));

const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
export const effectiveTheme = () => resolveTheme(prefs.theme, mq ? mq.matches : true);

function applyTheme() {
  const t = effectiveTheme();
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_BG[t]);
  TG.setBg(THEME_BG[t]);
}

export function setPref(k, v) {
  prefs[k] = v;
}

export function initPrefs() {
  applyTheme();
  watch(prefs, () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: prefs.theme, lang: prefs.lang })); } catch (e) { /* немає доступу до сховища */ }
    applyTheme();
  });
  if (mq) (mq.addEventListener ? mq.addEventListener("change", applyTheme) : mq.addListener(applyTheme));
}
