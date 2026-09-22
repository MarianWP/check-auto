/* Клієнт Supabase. Без VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY хмарні функції вимкнені,
   а застосунок працює як раніше: лише локально. Ключ anon публічний, права обмежує RLS у базі.
   Помилка в секретах ніколи не має ламати застосунок: тоді хмара вимкнена і є текст помилки. */
import { createClient } from "@supabase/supabase-js";
import { cloudConfig } from "../logic/cloud";

const cfg = cloudConfig(import.meta.env);
let client = null, error = cfg.error;
if (cfg.enabled) {
  try { client = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }); }
  catch (e) { error = "Supabase: " + (e && e.message ? e.message : String(e)); }
}
if (error) console.error("[cloud] " + error);

export const CLOUD = !!client;
export const CLOUD_URL = client ? cfg.url : "";
export const CLOUD_KEY = client ? cfg.key : "";
export const CLOUD_ERROR = error;
export const TG_BOT = (import.meta.env.VITE_TG_BOT || "").trim().replace(/^@/, "");
export const supabase = client;

/* Публічна адреса файлу з бакета photos. */
export const publicUrl = path => (supabase ? supabase.storage.from("photos").getPublicUrl(path).data.publicUrl : "");
export const errText = e => (e && (e.message || e.error_description || e.error)) || "Невідома помилка";
