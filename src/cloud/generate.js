/* «Інше авто»: запит до Edge Function generate, нормалізація відповіді, реєстрація моделі. */
import { reactive, watch } from "vue";
import { CLOUD, CLOUD_URL, CLOUD_KEY, supabase, errText } from "./client";
import { normalizeGenerated } from "../logic/generated";
import { user } from "./auth";
import { account, addModel } from "../store";

export const gen = reactive({ state: "idle", error: "", remaining: null, startedAt: 0 });
let ctrl = null, seq = 0;
watch(() => user.value?.id, () => { cancelGenerate(); gen.error = ""; gen.remaining = null; }, { flush: "sync" });

/* Повертає модель (уже зареєстровану) або null; текст помилки у gen.error. */
export async function generateModel(input) {
  if (!CLOUD) { gen.error = "Потрібна хмара"; return null; }
  if (gen.state === "working") return null;
  const owner = user.value?.id, run = ++seq;
  const controller = new AbortController(); ctrl = controller;
  const valid = () => run === seq && owner === user.value?.id && owner === account.scope;
  const timer = setTimeout(() => controller.abort(), 120000);
  gen.state = "working"; gen.error = ""; gen.startedAt = Date.now();
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!valid()) return null;
    const token = session?.session?.access_token;
    if (!token) throw new Error("Потрібен вхід через Telegram");
    const res = await fetch(CLOUD_URL + "/functions/v1/generate", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: CLOUD_KEY, Authorization: "Bearer " + token },
      body: JSON.stringify(input)
    });
    let j = null;
    try { j = await res.json(); } catch (e) { j = null; }
    if (!valid()) return null;
    if (!res.ok) throw new Error((j && j.error) || "Сервіс недоступний (" + res.status + ")");
    if (j && typeof j.remaining === "number") gen.remaining = j.remaining;
    const def = normalizeGenerated(j && j.def, { id: j && j.id, createdAt: j && j.createdAt, source: Object.assign({}, input, { year: Number(input.year) }) });
    if (!def) throw new Error("ШІ повернув неповні дані, спробуй ще раз");
    addModel(def);
    gen.state = "done";
    return def;
  } catch (e) {
    if (!valid()) return null;
    gen.state = "idle";
    gen.error = e && e.name === "AbortError" ? "Генерація не завершилась вчасно. Спробуй ще раз." : (e && e.message ? e.message : errText(e));
    return null;
  } finally { clearTimeout(timer); if (valid()) ctrl = null; }
}
export function cancelGenerate() { seq++; if (ctrl) ctrl.abort(); ctrl = null; gen.state = "idle"; }
