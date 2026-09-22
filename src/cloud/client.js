/* Клієнт Supabase. Без VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY хмарні функції вимкнені,
   а застосунок працює як раніше: лише локально. Ключ anon публічний, права обмежує RLS у базі. */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const CLOUD = !!(url && key);
export const TG_BOT = import.meta.env.VITE_TG_BOT || "";
export const supabase = CLOUD ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

/* Публічна адреса файлу з бакета photos. */
export const publicUrl = path => (supabase ? supabase.storage.from("photos").getPublicUrl(path).data.publicUrl : "");
export const errText = e => (e && (e.message || e.error_description || e.error)) || "Невідома помилка";
