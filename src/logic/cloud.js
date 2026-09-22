/* Чиста логіка налаштувань хмари: приводить значення з секретів збірки до робочого вигляду,
   щоб описка в секреті давала зрозуміле повідомлення, а не порожній екран. */

const REF = /^[a-z]{20}$/;

/* Адреса проєкту Supabase: повний URL, або лише ref (20 літер), або без https://. Порожній рядок = невалідно. */
export function normalizeSupabaseUrl(raw) {
  let s = String(raw || "").trim().replace(/\/+$/, "");
  if (!s) return "";
  if (REF.test(s)) s = "https://" + s + ".supabase.co";
  else if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try { const u = new URL(s); if (u.protocol !== "https:" && u.protocol !== "http:") return ""; if (!u.hostname.includes(".")) return ""; return u.origin + u.pathname.replace(/\/+$/, ""); } catch (e) { return ""; }
}

/* Ключ anon: прибирає лапки і пробіли, які часто потрапляють при копіюванні. */
export function normalizeKey(raw) {
  return String(raw || "").trim().replace(/^["']|["']$/g, "").trim();
}

/* Підсумок налаштувань: { url, key, enabled, error }. error — текст для людини, коли щось задано, але криво. */
export function cloudConfig(env) {
  const rawUrl = env.VITE_SUPABASE_URL || "", rawKey = env.VITE_SUPABASE_ANON_KEY || "";
  if (!rawUrl && !rawKey) return { url: "", key: "", enabled: false, error: "" };
  const url = normalizeSupabaseUrl(rawUrl), key = normalizeKey(rawKey);
  if (!url) return { url: "", key: "", enabled: false, error: "VITE_SUPABASE_URL має бути адресою проєкту виду https://<ref>.supabase.co" };
  if (!key) return { url: "", key: "", enabled: false, error: "VITE_SUPABASE_ANON_KEY порожній" };
  return { url, key, enabled: true, error: "" };
}
