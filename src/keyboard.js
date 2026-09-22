/* Екранна клавіатура. Через visualViewport визначаємо, що клавіатура відкрита, і тоді:
   – ховаємо нижні панелі (клас kb-open), щоб вони не забирали видиме місце;
   – піднімаємо аркуш над клавіатурою (змінна --kb);
   – прокручуємо поле з фокусом у видиму частину екрана.
   Масштабування двома пальцями теж зменшує visualViewport, тому при scale > 1 нічого не робимо. */
import { reduced } from "./store";

const isField = el => !!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(file|checkbox|radio|button|submit)$/.test(el.type)));

export function initKeyboard() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) return;
  let maxH = vv.height;

  function reveal(el) {
    const scroller = el.closest(".screen, .sheet-in"); if (!scroller) return;
    const r = el.getBoundingClientRect();
    const top = vv.offsetTop, h = vv.height;
    if (r.top >= top + 64 && r.bottom <= top + h - 24) return;
    scroller.scrollBy({ top: r.top + r.height / 2 - (top + h / 2), behavior: reduced() ? "auto" : "smooth" });
  }
  function update() {
    if (vv.scale > 1.01) return;
    if (vv.height > maxH) maxH = vv.height;
    const el = document.activeElement;
    const open = isField(el) && maxH - vv.height > 140;
    root.classList.toggle("kb-open", open);
    /* Висота клавіатури; обмежена 60 % екрана, бо під час анімації iOS іноді дає завищене значення, і низ апки поїхав би догори. */
    /* У Telegram висоту видимої області дає сам Telegram (див. layout.css), тому власний зсув там не потрібен. */
    const kb = open && !root.dataset.tg ? Math.min(Math.round(window.innerHeight * 0.6), Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))) : 0;
    root.style.setProperty("--kb", kb + "px");
    if (open) reveal(el);
  }
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  window.addEventListener("orientationchange", () => { maxH = 0; setTimeout(update, 350); });
  document.addEventListener("focusin", e => { if (isField(e.target)) setTimeout(() => { update(); reveal(e.target); }, 320); });
  document.addEventListener("focusout", () => setTimeout(update, 120));
}
