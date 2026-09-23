/* Контент з адмінки: власні пункти чек-листа й фото до проблем. Читається без входу (anon),
   кешується в localStorage, тож офлайн лишається останній завантажений стан. */
import { reactive } from "vue";
import { CLOUD, sb, errText } from "./client";
import { extraItems } from "../store";
import { itemFromRow, photoFromRow, photosFor as photosForPure } from "../logic/content";

export const content = reactive({ photos: [], loadedAt: 0, error: "" });
const CKEY = "golfcheck.content.v1";

function apply(items, photos, at) {
  extraItems.list = items.map(itemFromRow).filter(Boolean);
  content.photos = photos.map(photoFromRow).filter(Boolean);
  content.loadedAt = at;
}
export async function refreshContent() {
  if (!CLOUD || !navigator.onLine) return;
  try {
    const supabase = await sb();
    const [a, b] = await Promise.all([
      supabase.from("checklist_items").select("*").eq("enabled", true).order("sort"),
      supabase.from("photos").select("*").order("created_at")
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    const at = Date.now();
    apply(a.data || [], b.data || [], at);
    content.error = "";
    try { localStorage.setItem(CKEY, JSON.stringify({ items: a.data, photos: b.data, at })); } catch (e) { /* немає місця */ }
  } catch (e) { content.error = errText(e); }
}
export function initContent() {
  if (!CLOUD) return;
  try { const c = JSON.parse(localStorage.getItem(CKEY) || "null"); if (c && Array.isArray(c.items)) apply(c.items, c.photos || [], c.at || 0); } catch (e) { /* пошкоджений кеш */ }
  refreshContent();
  window.addEventListener("online", refreshContent);
}
export const photosFor = (kind, target, idx, model) => photosForPure(content.photos, kind, target, idx, model);
