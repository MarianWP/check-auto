// Edge Function telegram-auth: перевіряє підпис Telegram і видає одноразовий token_hash для входу в Supabase.
// Приймає { initData } з Mini App або { widget } з Telegram Login Widget.
// Секрети: TELEGRAM_BOT_TOKEN (обов'язково), SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY (є в середовищі функцій).
import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const MAX_AGE_SEC = 24 * 60 * 60;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
async function hmac(key: BufferSource, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}
const safeEqual = (a: string, b: string) => a.length === b.length && a.split("").every((c, i) => c === b[i]);

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string };

// Mini App: secret = HMAC("WebAppData", bot_token); hash = HMAC(secret, data_check_string).
async function verifyInitData(initData: string): Promise<TgUser> {
  const p = new URLSearchParams(initData);
  const hash = p.get("hash") ?? ""; p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), BOT_TOKEN);
  const expected = hex(await hmac(secret, dcs));
  if (!hash || !safeEqual(expected, hash)) throw new Error("Підпис Telegram не збігається");
  const age = Date.now() / 1000 - Number(p.get("auth_date") ?? 0);
  if (!(age >= -300 && age < MAX_AGE_SEC)) throw new Error("Дані запуску застаріли, відкрий застосунок знову");
  const user = JSON.parse(p.get("user") ?? "null");
  if (!user || !user.id) throw new Error("У даних запуску немає користувача");
  return user;
}

// Login Widget: secret = SHA256(bot_token); hash = HMAC(secret, "k=v\n...").
async function verifyWidget(w: Record<string, unknown>): Promise<TgUser> {
  const hash = String(w.hash ?? "");
  const dcs = Object.keys(w).filter(k => k !== "hash" && w[k] !== undefined && w[k] !== null).sort().map(k => `${k}=${w[k]}`).join("\n");
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(BOT_TOKEN));
  const expected = hex(await hmac(secret, dcs));
  if (!hash || !safeEqual(expected, hash)) throw new Error("Підпис Telegram не збігається");
  const age = Date.now() / 1000 - Number(w.auth_date ?? 0);
  if (!(age >= -300 && age < MAX_AGE_SEC)) throw new Error("Дані входу застаріли, увійди знову");
  if (!w.id) throw new Error("Немає id користувача");
  return { id: Number(w.id), first_name: w.first_name as string, last_name: w.last_name as string, username: w.username as string, photo_url: w.photo_url as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN не задано" }, 500);
  try {
    const body = await req.json();
    const tg: TgUser = body.initData ? await verifyInitData(String(body.initData)) : await verifyWidget(body.widget ?? {});
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const email = `tg${tg.id}@telegram.golfcheck.local`;
    const meta = { tg_id: tg.id, first_name: tg.first_name ?? "", last_name: tg.last_name ?? "", username: tg.username ?? "", photo_url: tg.photo_url ?? "", provider: "telegram" };

    // Користувач: створюємо, якщо ще немає (помилку «вже існує» ігноруємо).
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
    let userId = created.data.user?.id;
    if (!userId) {
      const found = await admin.from("profiles").select("id").eq("tg_id", tg.id).maybeSingle();
      userId = found.data?.id;
      if (!userId) {
        const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = list.data.users.find(u => u.email === email)?.id;
      }
      if (!userId) throw new Error(created.error?.message ?? "Не вдалося створити користувача");
      await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
    }
    const prof = await admin.from("profiles").upsert({ id: userId, tg_id: tg.id, username: meta.username, first_name: meta.first_name, last_name: meta.last_name, photo_url: meta.photo_url }, { onConflict: "id" });
    if (prof.error) throw prof.error;

    // Одноразовий token_hash: клієнт обміняє його на сесію через verifyOtp, лист нікуди не йде.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    return json({ token_hash: link.data.properties.hashed_token, user: { id: tg.id, first_name: meta.first_name, username: meta.username } });
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 401);
  }
});
