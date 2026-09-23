<script setup>
/* «Інше авто»: форма (марка, модель, рік, паливо, двигун, коробка, кузов) → ШІ складає картку й чек-лист.
   Поки чекаємо, показуємо кроки роботи і смугу прогресу; результат стає моделлю в реєстрі, і огляд створюється одразу. */
import { reactive, ref, computed, onUnmounted } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import ChipGroup from "../components/ChipGroup.vue";
import TelegramLogin from "../components/TelegramLogin.vue";
import BRANDS from "../data/brands.js";
import { FUELS, GEARS, BODIES, YEAR_MIN, YEAR_MAX, GEN_STEPS, inputError } from "../logic/generated";
import { auth, user, loginMiniApp } from "../cloud/auth";
import { CLOUD_ERROR } from "../cloud/client";
import { gen, generateModel, cancelGenerate } from "../cloud/generate";
import { resetDraft, createInspection, toast, reduced } from "../store";
import { go } from "../nav";
import TG from "../tg";

const inTelegram = TG.active;
const ready = computed(() => auth.enabled && !!user.value);
const f = reactive({ brand: "", model: "", year: "", fuel: "petrol", engine: "", gear: "unknown", body: "", name: "", price: "" });
const YEARS = []; for (let y = YEAR_MAX; y >= YEAR_MIN; y--) YEARS.push(y);
const BODY_OPTS = BODIES.map(b => ({ id: b, name: b }));
const FUEL_OPTS = FUELS;
const GEAR_OPTS = GEARS.map(g => ({ id: g.id, name: g.name }));
const err = ref("");
const step = ref(0), progress = ref(0);
let timer = null, navigateTimer = null, mounted = true;

function tick() {
  const t = Date.now() - gen.startedAt;
  progress.value = Math.min(92, Math.round(92 * (1 - Math.exp(-t / 18000))));
  step.value = Math.min(GEN_STEPS.length - 1, Math.floor(t / 3500));
}
async function submit() {
  err.value = inputError(f);
  if (err.value || gen.state === "working") return;
  TG.haptic("select");
  step.value = 0; progress.value = 0;
  timer = setInterval(tick, 250);
  const def = await generateModel({ brand: f.brand.trim(), model: f.model.trim(), year: Number(f.year), fuel: f.fuel, engine: f.engine.trim(), gear: f.gear, body: f.body });
  clearInterval(timer); timer = null;
  if (!mounted) return;
  if (!def) { err.value = gen.error; return; }
  progress.value = 100; step.value = GEN_STEPS.length - 1;
  resetDraft({ model: def.id, fuel: def.engineLib.e1.fuel, engine: "e1", body: "b1", year: Number(f.year), gear: "g1", name: f.name, price: f.price });
  const i = createInspection();
  if (!i) { err.value = "Перевір конфігурацію авто"; gen.state = "idle"; return; }
  TG.haptic("success");
  toast("Картку і чек-лист для " + def.brand + " " + def.name + " підготовлено", 3500);
  navigateTimer = setTimeout(() => go("/car/" + i.id), reduced() ? 0 : 500);
}
function cancel() { clearInterval(timer); timer = null; cancelGenerate(); }
onUnmounted(() => { mounted = false; clearTimeout(navigateTimer); cancel(); });
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/new" back-label="новий огляд" title="Інше авто" kicker="Новий огляд · ШІ" lead="Впиши, що знаєш про авто. ШІ збере типові хвороби, ціни й складе чек-лист саме під цю модель." />
    <div class="content" :class="enter">

      <div v-if="CLOUD_ERROR" class="notice warn" data-notice="gen-off"><AppIcon name="alert" /><div><b>Хмару налаштовано з помилкою</b>{{ CLOUD_ERROR }}. Картки від ШІ поки недоступні.</div></div>
      <div v-else-if="!auth.enabled" class="notice info" data-notice="gen-off"><AppIcon name="alert" /><div><b>Потрібна хмара</b>Картки від ШІ з'являться, коли адміністратор підключить Supabase і ключ OpenAI. Golf V і Octavia доступні без цього.</div></div>
      <div v-else-if="!user" class="card account" data-notice="gen-login">
        <p class="prose">Увійди через Telegram, щоб ШІ склав картку. Картка збережеться у твоєму акаунті й буде на всіх пристроях.</p>
        <button v-if="inTelegram" class="btn" data-action="login" :disabled="auth.busy" @click="loginMiniApp()"><AppIcon name="share" /><span>{{ auth.busy ? 'Входимо…' : 'Увійти через Telegram' }}</span></button>
        <TelegramLogin v-else />
      </div>

      <section v-else-if="gen.state === 'working' || gen.state === 'done'" class="gen" data-gen aria-live="polite" aria-busy="true">
        <div class="gen-orb" :class="{ done: gen.state === 'done' }" aria-hidden="true"><span class="gen-ring"></span><span class="gen-ring r2"></span><AppIcon name="sparkles" cls="lg" /></div>
        <h2 class="gen-t">{{ gen.state === 'done' ? 'Готово' : 'ШІ готує огляд' }}</h2>
        <p class="gen-sub">{{ f.brand }} {{ f.model }} · {{ f.year }}</p>
        <div class="gen-bar" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="Прогрес"><span class="gen-fill" :style="{ width: progress + '%' }"></span></div>
        <ol class="gen-steps">
          <li v-for="(s, k) in GEN_STEPS" :key="s" class="gen-step" :class="{ on: k === step && gen.state !== 'done', done: k < step || gen.state === 'done' }">
            <span class="gen-dot" aria-hidden="true"><AppIcon v-if="k < step || gen.state === 'done'" name="check" /></span><span>{{ s }}</span>
          </li>
        </ol>
        <p class="foot center">Зазвичай 20–40 секунд. Дані від ШІ орієнтовні: перевіряй критичне на СТО.</p>
        <button v-if="gen.state === 'working'" class="btn ghost" data-action="cancel" @click="cancel"><span>Скасувати</span></button>
      </section>

      <form v-else class="fields" style="margin-top: var(--s4)" data-gen-form novalidate @submit.prevent="submit">
        <label class="field"><span class="field-label">Марка</span><input v-model="f.brand" class="input" name="brand" list="brands" maxlength="40" required placeholder="Toyota" autocomplete="off" autocapitalize="words" enterkeyhint="next"><datalist id="brands"><option v-for="b in BRANDS" :key="b" :value="b"></option></datalist></label>
        <label class="field"><span class="field-label">Модель і покоління</span><input v-model="f.model" class="input" name="model" maxlength="60" required placeholder="Corolla E150" autocomplete="off" enterkeyhint="next"></label>
        <label class="field"><span class="field-label">Рік випуску</span><select v-model="f.year" class="input select" name="year" required><option value="" disabled>Обери рік</option><option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option></select></label>
        <div class="field"><span class="field-label">Паливо</span><ChipGroup :list="FUEL_OPTS" :sel="f.fuel" k="gfuel" label="Паливо" @pick="(_k, v) => { f.fuel = v; }" /></div>
        <label class="field"><span class="field-label">Двигун, якщо знаєш (необов'язково)</span><input v-model="f.engine" class="input" name="engine" maxlength="60" placeholder="1.6, 124 к.с." autocomplete="off" enterkeyhint="next"><span class="hint">Об'єм, потужність або код двигуна з оголошення. Без цього ШІ візьме найпоширеніший.</span></label>
        <div class="field"><span class="field-label">Коробка передач</span><ChipGroup :list="GEAR_OPTS" :sel="f.gear" k="ggear" label="Коробка передач" @pick="(_k, v) => { f.gear = v; }" /></div>
        <div class="field"><span class="field-label">Кузов (необов'язково)</span><ChipGroup :list="BODY_OPTS" :sel="f.body" k="gbody" label="Кузов" @pick="(_k, v) => { f.body = f.body === v ? '' : v; }" /></div>
        <label class="field"><span class="field-label">Назва огляду (необов'язково)</span><input v-model="f.name" class="input" name="name" maxlength="60" placeholder="Сірий, Львів, від власника" autocomplete="off"></label>
        <label class="field"><span class="field-label">Ціна продавця, $ (необов'язково)</span><input v-model="f.price" class="input" name="price" inputmode="numeric" placeholder="7500" autocomplete="off"></label>
        <p v-if="err" class="notice bad" role="alert"><AppIcon name="alert" /><span>{{ err }}</span></p>
        <p v-if="gen.remaining !== null" class="hint">Лишилося карток на сьогодні: {{ gen.remaining }}</p>
        <button class="btn" type="submit" data-action="generate-go"><AppIcon name="sparkles" /><span>Підготувати огляд з ШІ</span></button>
      </form>
    </div>
  </AppScreen>
</template>
