/* Навігація: напрямок анімації входу, глибина для «Назад», позиції скролу, вкладки.
   Роутер підставляється з router.js, щоб уникнути циклічного імпорту. */
import TG from "./tg";
import { reduced } from "./store";

export const nav = { dir: "", depth: 0, scroll: Object.create(null) };
let router = null;
export const setRouter = r => { router = r; };
export const scroller = () => document.querySelector(".screen");

export function go(to) {
  if (router.currentRoute.value.fullPath === to) return;
  nav.dir = "fwd"; nav.depth++;
  router.push(to);
}
export function back(fallback) {
  nav.dir = "back";
  if (nav.depth > 0) { nav.depth--; router.back(); }
  else router.replace(fallback || "/");
}
/* Вкладки не пишуть історію; повторний тап на активній — скрол угору. */
export function switchTab(to) {
  if (router.currentRoute.value.path === to) {
    const s = scroller(); if (s) s.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    return;
  }
  TG.haptic("select");
  nav.dir = "tab";
  router.replace(to);
}
