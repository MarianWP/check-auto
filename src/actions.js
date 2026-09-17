/* Глобальні дії над перевіркою: меню, перейменування, видалення, поділитися, копіювати. */
import G from "./data/golf";
import TG from "./tg";
import { insp, sheet, toast, rename, remove, reportText } from "./store";
import { go, nav } from "./nav";
import router from "./router";

export function menu(id) {
  const i = insp(id); if (!i) return;
  sheet({ title: i.name || G.label(i.cfg), actions: [
    { icon: "car", label: "Картка авто", fn: () => go("/car/" + id) },
    { icon: "clipboard", label: "Чек-лист", fn: () => go("/check/" + id + "/" + (i.stage || 0)) },
    { icon: "fileText", label: "Звіт", fn: () => go("/report/" + id) },
    { icon: "pencil", label: "Перейменувати", fn: () => renameSheet(id) },
    { icon: "trash", label: "Видалити огляд", danger: true, fn: () => confirmDelete(id) }
  ] });
}
export function renameSheet(id) {
  const i = insp(id); if (!i) return;
  sheet({ title: "Перейменувати огляд", input: { label: "Назва огляду", value: i.name || "", placeholder: G.label(i.cfg) }, actions: [
    { label: "Зберегти", primary: true, fn: v => rename(i, v) }
  ] });
}
export function confirmDelete(id) {
  const i = insp(id); if (!i) return;
  sheet({ title: "Видалити огляд «" + (i.name || G.label(i.cfg)) + "»?", text: "Відповіді й коментарі зникнуть. Повернути їх можна буде лише з резервної копії.", actions: [
    { icon: "trash", label: "Видалити огляд", danger: true, fn: () => {
      remove(id);
      const r = router.currentRoute.value;
      if (r.params && r.params.id === id) { nav.dir = "back"; router.replace("/"); }
      toast("Огляд видалено");
    } }
  ] });
}
export async function share(id) {
  const i = insp(id); if (!i) return;
  const text = reportText(i);
  if (TG.active) {
    sheet({ title: "Поділитися звітом", actions: [
      { icon: "share", label: "Надіслати в Telegram", fn: () => TG.share(text) },
      { icon: "clipboard", label: "Скопіювати текст", fn: () => copy(text) }
    ] });
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: "Golf Check — звіт", text }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  copy(text);
}
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Звіт скопійовано"); }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Звіт скопійовано"); } catch (e2) { toast("Не вдалося скопіювати"); }
    ta.remove();
  }
}
