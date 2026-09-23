/* Клієнт Supabase. Без VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY хмарні функції вимкнені,
   а застосунок працює як раніше: лише локально. Ключ anon публічний, права обмежує RLS у базі.
   Помилка в секретах ніколи не має ламати застосунок: тоді хмара вимкнена і є текст помилки.
   Сама бібліотека (~220 КБ) вантажиться окремим шматком лише при першому зверненні через sb(),
   тож перший екран її не чекає; service worker усе одно тримає її в кеші для офлайну. */
import { cloudConfig, authStorageKey } from "../logic/cloud";

const cfg = cloudConfig(import.meta.env);
if (cfg.error) console.error("[cloud] " + cfg.error);

export const CLOUD = cfg.enabled;
export const CLOUD_URL = cfg.enabled ? cfg.url : "";
export const CLOUD_KEY = cfg.enabled ? cfg.key : "";
export const CLOUD_ERROR = cfg.error;
export const TG_BOT = (import.meta.env.VITE_TG_BOT || "").trim().replace(/^@/, "");
/* Де supabase-js зберігає сесію: auth.js читає її одразу на старті, не чекаючи бібліотеки. */
export const AUTH_KEY = cfg.enabled ? authStorageKey(cfg.url) : "";

let client = null;
/* Проміс клієнта Supabase. Невдале завантаження (немає мережі при першому відкритті) можна повторити. */
export function sb() {
  if (!CLOUD) return Promise.reject(new Error("Хмару не налаштовано"));
  return client ||= import("@supabase/supabase-js")
    .then(({ createClient }) => createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }))
    .catch(e => { client = null; throw e; });
}

/* Публічна адреса файлу з бакета photos — так само, як storage.getPublicUrl, але без бібліотеки. */
export const publicUrl = path => (CLOUD && path ? encodeURI(CLOUD_URL + "/storage/v1/object/public/photos/" + String(path).replace(/^\/+/, "")) : "");
export const errText = e => (e && (e.message || e.error_description || e.error)) || "Невідома помилка";
