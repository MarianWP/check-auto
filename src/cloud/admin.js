/* Адмінка: власні пункти чек-листа і фото до проблем. Права перевіряє RLS (роль admin у profiles). */
import { supabase, errText } from "./client";
import { refreshContent } from "./content";
import { rowFromForm } from "../logic/content";
import { toast } from "../store";

async function run(promise, okMsg) {
  const { data, error } = await promise;
  if (error) { toast("Помилка: " + errText(error), 4000); throw error; }
  if (okMsg) toast(okMsg);
  await refreshContent();
  return data;
}

export async function listItems() {
  const { data, error } = await supabase.from("checklist_items").select("*").order("stage").order("sort");
  if (error) { toast("Помилка: " + errText(error), 4000); return []; }
  return data || [];
}
export async function saveItem(form, id) {
  const { row, error } = rowFromForm(form);
  if (error) { toast(error, 3500); return null; }
  const q = id ? supabase.from("checklist_items").update(row).eq("id", id).select().single() : supabase.from("checklist_items").insert(row).select().single();
  return run(q, id ? "Пункт оновлено" : "Пункт додано");
}
export const deleteItem = id => run(supabase.from("checklist_items").delete().eq("id", id), "Пункт видалено");

/* Фото з телефона стискаємо до 1600 px і JPEG 0.85: сховище й трафік користувачів. */
export async function shrinkImage(file, max = 1600) {
  if (!/^image\//.test(file.type)) throw new Error("Це не зображення");
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
  return blob || file;
}
export async function uploadPhoto(file, meta) {
  const blob = await shrinkImage(file);
  const path = meta.kind + "/" + meta.target + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ".jpg";
  const up = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) { toast("Не вдалося завантажити фото: " + errText(up.error), 4000); throw up.error; }
  return run(supabase.from("photos").insert({ model: meta.model || null, kind: meta.kind, target: String(meta.target), idx: meta.idx || 0, path, caption: (meta.caption || "").slice(0, 200) }).select().single(), "Фото додано");
}
export async function updateCaption(id, caption) {
  return run(supabase.from("photos").update({ caption: String(caption || "").slice(0, 200) }).eq("id", id), "Підпис збережено");
}
export async function deletePhoto(p) {
  await supabase.storage.from("photos").remove([p.path]);
  return run(supabase.from("photos").delete().eq("id", p.id), "Фото видалено");
}
