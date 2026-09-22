/* Чиста логіка налаштувань користувача: тема інтерфейсу і мова відповідей помічника.
   Зберігаються окремо від оглядів (ключ golfcheck.prefs.v1), щоб не чіпати формат golfcheck.v1. */

export const PREFS_KEY = "golfcheck.prefs.v1";
export const THEMES = [
  { id: "dark", name: "Темна", desc: "Основна тема застосунку" },
  { id: "light", name: "Світла", desc: "Для яскравого сонця на майданчику" },
  { id: "system", name: "Як у системі", desc: "Слідує за налаштуванням телефона" }
];
export const LANGS = [
  { id: "uk", name: "Українська" },
  { id: "ru", name: "Русский" },
  { id: "en", name: "English" }
];
export const DEFAULT_PREFS = { theme: "dark", lang: "uk" };

const has = (list, id) => list.some(x => x.id === id);

/* Розбирає збережений JSON; будь-яке сміття дає типові значення, а не виняток. */
export function parsePrefs(raw) {
  let o = null;
  try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return Object.assign({}, DEFAULT_PREFS);
  return {
    theme: has(THEMES, o.theme) ? o.theme : DEFAULT_PREFS.theme,
    lang: has(LANGS, o.lang) ? o.lang : DEFAULT_PREFS.lang
  };
}

/* Яку тему фактично показувати: system → за системною, решта як є. */
export const resolveTheme = (theme, systemDark) => (theme === "system" ? (systemDark ? "dark" : "light") : theme);

/* Колір фону теми: для meta theme-color і рамки Telegram. */
export const THEME_BG = { dark: "#101112", light: "#F2F2F4" };
