/* Резервна копія: експорт у файл JSON (або буфер обміну в Telegram) та імпорт зі злиттям без втрат. */
import TG from "./tg";
import { db, toast, replaceInspections, flush, aiModels, saveModels } from "./store";
import { makeBackup, parseBackup, mergeInspections } from "./logic/storage";

const fileName = () => "golf-check-" + new Date().toISOString().slice(0, 10) + ".json";

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

/* Викликати прямо з обробника кліку: share і download потребують жесту користувача. */
export async function exportBackup() {
  if (!db.inspections.length) { toast("Поки немає що зберігати"); return; }
  const text = JSON.stringify(makeBackup(db.inspections, Date.now(), aiModels()), null, 2);
  /* Вебв'ю Telegram не вміє завантажувати файли — віддаємо текст у буфер обміну. */
  if (TG.active) {
    toast(await copyText(text) ? "Копію скопійовано. Встав її у «Збережене»." : "Не вдалося скопіювати копію", 3500);
    return;
  }
  const file = typeof File === "function" ? new File([text], fileName(), { type: "application/json" }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Golf Check — резервна копія" }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = fileName();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Копію збережено у файл");
}

/* Імпорт тексту копії: наявні перевірки не видаляються, з однаковим id лишається новіша. */
export function importBackupText(text) {
  let parsed;
  try { parsed = parseBackup(text); }
  catch (e) { toast(e.message, 4000); return null; }
  if (parsed.models && parsed.models.length) saveModels();
  const res = mergeInspections(db.inspections, parsed.inspections);
  if (res.added || res.updated) { replaceInspections(res.list); flush(); }
  const parts = [];
  if (res.added) parts.push("додано " + res.added);
  if (res.updated) parts.push("оновлено " + res.updated);
  if (res.skipped) parts.push("без змін " + res.skipped);
  if (parsed.rejected) parts.push("пошкоджених " + parsed.rejected);
  toast(parts.length ? "Копію відновлено: " + parts.join(", ") : "У копії немає перевірок", 4000);
  return res;
}

export function importBackupFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast("Файл завеликий для копії Golf Check", 3500); return; }
  const reader = new FileReader();
  reader.onload = () => importBackupText(String(reader.result || ""));
  reader.onerror = () => toast("Не вдалося прочитати файл", 3500);
  reader.readAsText(file);
}

export async function importBackupFromClipboard() {
  let text = "";
  try { text = await navigator.clipboard.readText(); }
  catch (e) { toast("Немає доступу до буфера обміну", 3500); return; }
  if (!text.trim()) { toast("Буфер обміну порожній"); return; }
  importBackupText(text);
}
