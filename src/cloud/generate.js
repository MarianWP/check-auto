/* «Інше авто»: запит до Edge Function generate, нормалізація відповіді, реєстрація моделі. */
import { reactive } from "vue";
import { CLOUD, CLOUD_URL, CLOUD_KEY, supabase, errText } from "./client";
import { normalizeGenerated } from "../logic/generated";
import { addModel } from "../store";

export const gen = reactive({ state: "idle", error: "", remaining: null, startedAt: 0 });
let ctrl = null;

/* Повертає модель (уже зареєстровану) або null; текст помилки у gen.error. */
export async function generateModel(input) {
  if (!CLOUD) { gen.error = "Потрібна хмара"; return null; }
  const { data: s } = await supabase.auth.getSession();
  const token = s && s.session && s.session.access_token;
  if (!token) { gen.error = "Потрібен вхід через Telegram"; return null; }
  ctrl = new AbortController();
  gen.state = "working"; gen.error = ""; gen.startedAt = Date.now();
  try {
    const res = await fetch(CLOUD_URL + "/functions/v1/generate", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: CLOUD_KEY, Authorization: "Bearer " + token },
      body: JSON.stringify(input)
    });
    let j = null;
    try { j = await res.json(); } catch (e) { j = null; }
    if (!res.ok) throw new Error((j && j.error) || "Сервіс недоступний (" + res.status + ")");
    if (j && typeof j.remaining === "number") gen.remaining = j.remaining;
    const def = normalizeGenerated(j && j.def, { id: j && j.id, createdAt: j && j.createdAt, source: Object.assign({}, input, { year: Number(input.year) }) });
    if (!def) throw new Error("ШІ повернув неповні дані, спробуй ще раз");
    addModel(def);
    gen.state = "done";
    return def;
  } catch (e) {
    gen.state = "idle";
    gen.error = e && e.name === "AbortError" ? "" : (e && e.message ? e.message : errText(e));
    return null;
  } finally { ctrl = null; }
}
export function cancelGenerate() { if (ctrl) ctrl.abort(); gen.state = "idle"; }
