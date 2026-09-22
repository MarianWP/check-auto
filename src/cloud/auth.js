/* Вхід через Telegram.
   У Mini App: initData від Telegram → Edge Function telegram-auth перевіряє підпис ботом → повертає одноразовий
   token_hash → supabase.auth.verifyOtp дає звичайну сесію Supabase. Поза Telegram те саме робить Telegram Login Widget.
   Профіль (profiles) містить роль: user або admin. */
import { reactive, computed } from "vue";
import { CLOUD, supabase, errText } from "./client";
import TG from "../tg";
import { toast } from "../store";

export const auth = reactive({ enabled: CLOUD, ready: false, session: null, profile: null, busy: false, error: "" });
export const user = computed(() => (auth.session && auth.session.user) || null);
export const isAdmin = computed(() => !!(auth.profile && auth.profile.role === "admin"));
export const displayName = computed(() => {
  const p = auth.profile, m = (user.value && user.value.user_metadata) || {};
  return (p && (p.first_name || p.username)) || m.first_name || m.username || "Користувач Telegram";
});

export async function loadProfile() {
  if (!CLOUD || !user.value) { auth.profile = null; return; }
  const { data, error } = await supabase.from("profiles").select("id, tg_id, username, first_name, last_name, photo_url, role").eq("id", user.value.id).maybeSingle();
  if (!error) auth.profile = data;
}

async function exchange(body) {
  auth.busy = true; auth.error = "";
  try {
    const { data, error } = await supabase.functions.invoke("telegram-auth", { body });
    if (error) throw error;
    if (!data || !data.token_hash) throw new Error((data && data.error) || "Сервер не повернув токен");
    const { error: e2 } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.token_hash });
    if (e2) throw e2;
    await loadProfile();
    toast("Ти увійшов як " + displayName.value);
    return true;
  } catch (e) {
    auth.error = errText(e);
    toast("Не вдалося увійти: " + auth.error, 4000);
    return false;
  } finally { auth.busy = false; }
}

/* Mini App: підписані дані запуску вже є в SDK. */
export function loginMiniApp() {
  const initData = TG.active && TG.tg && TG.tg.initData;
  if (!initData) return Promise.resolve(false);
  return exchange({ initData });
}
/* Сайт: дані від Telegram Login Widget (id, first_name, username, photo_url, auth_date, hash). */
export const loginWidget = widget => exchange({ widget });

export async function logout() {
  if (!CLOUD) return;
  await supabase.auth.signOut();
  auth.profile = null;
  toast("Ти вийшов з акаунта");
}

export async function initAuth() {
  if (!CLOUD) { auth.ready = true; return; }
  const { data } = await supabase.auth.getSession();
  auth.session = data.session;
  supabase.auth.onAuthStateChange((_event, session) => { auth.session = session; loadProfile(); });
  await loadProfile();
  auth.ready = true;
  /* У Telegram входимо самі: користувач уже підтверджений клієнтом Telegram. */
  if (!auth.session && TG.active) TG.onReady(() => { if (!auth.session) loginMiniApp(); });
}
