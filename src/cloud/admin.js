/* Адмінка: власні пункти чек-листа і фото до проблем. Права перевіряє RLS (роль admin у profiles). */
import { sb, errText } from "./client";
import { refreshContent } from "./content";
import { rowFromForm, thumbPath, thumbScale } from "../logic/content";
import { toast } from "../store";

async function run(promise, okMsg) {
  const { data, error } = await promise;
  if (error) { toast("Помилка: " + errText(error), 4000); throw error; }
  if (okMsg) toast(okMsg);
  await refreshContent();
  return data;
}

export async function listItems() {
  const { data, error } = await (await sb()).from("checklist_items").select("*").order("stage").order("sort");
  if (error) { toast("Помилка: " + errText(error), 4000); return []; }
  return data || [];
}
export async function saveItem(form, id) {
  const { row, error } = rowFromForm(form);
  if (error) { toast(error, 3500); return null; }
  const supabase = await sb();
  const q = id ? supabase.from("checklist_items").update(row).eq("id", id).select().single() : supabase.from("checklist_items").insert(row).select().single();
  return run(q, id ? "Пункт оновлено" : "Пункт додано");
}
export const deleteItem = async id => run((await sb()).from("checklist_items").delete().eq("id", id), "Пункт видалено");

async function decode(file) {
  if (!/^image\//.test(file.type)) throw new Error("Це не зображення");
  return createImageBitmap(file);
}
function jpeg(bmp, k, quality) {
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
}
/* Фото з телефона стискаємо до 1600 px і JPEG 0.85: сховище й трафік користувачів. */
export async function shrinkImage(file, max = 1600) {
  const bmp = await decode(file);
  return (await jpeg(bmp, Math.min(1, max / Math.max(bmp.width, bmp.height)), 0.85)) || file;
}
/* Імена файлів унікальні й не перезаписуються, тож браузер і service worker можуть тримати їх рік. */
const STORE = { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" };
export async function uploadPhoto(file, meta) {
  const bmp = await decode(file);
  const full = (await jpeg(bmp, Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), 0.85)) || file;
  /* Мініатюра для смужки фото: ~20 КБ замість сотень КБ оригіналу. */
  const thumb = await jpeg(bmp, thumbScale(bmp.width, bmp.height), 0.8);
  if (bmp.close) bmp.close();
  const path = meta.kind + "/" + meta.target + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ".jpg";
  const supabase = await sb();
  const up = await supabase.storage.from("photos").upload(path, full, STORE);
  if (up.error) { toast("Не вдалося завантажити фото: " + errText(up.error), 4000); throw up.error; }
  /* Без мініатюри фото все одно покажеться: смужка тоді візьме оригінал. */
  if (thumb) { const t = await supabase.storage.from("photos").upload(thumbPath(path), thumb, STORE); if (t.error) console.error("[photos] " + errText(t.error)); }
  return run(supabase.from("photos").insert({ model: meta.model || null, kind: meta.kind, target: String(meta.target), idx: meta.idx || 0, path, caption: (meta.caption || "").slice(0, 200) }).select().single(), "Фото додано");
}
export async function updateCaption(id, caption) {
  return run((await sb()).from("photos").update({ caption: String(caption || "").slice(0, 200) }).eq("id", id), "Підпис збережено");
}
export async function deletePhoto(p) {
  const supabase = await sb();
  await supabase.storage.from("photos").remove([p.path, thumbPath(p.path)]);
  return run(supabase.from("photos").delete().eq("id", p.id), "Фото видалено");
}
