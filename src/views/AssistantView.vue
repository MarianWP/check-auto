<script setup>
/* Помічник ШІ: чат про огляд. Контекст — обраний огляд (типово останній незавершений) або без огляду.
   Працює лише з хмарою і після входу; без них екран чесно пояснює, чого бракує. */
import { ref, computed, watch, nextTick, onMounted } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import ProfileButton from "../components/ProfileButton.vue";
import ChipGroup from "../components/ChipGroup.vue";
import TelegramLogin from "../components/TelegramLogin.vue";
import { db, apiOf, computeReport, visibleStages, VERDICTS, sheet, reduced } from "../store";
import { auth, user, loginMiniApp } from "../cloud/auth";
import { CLOUD_ERROR } from "../cloud/client";
import { chat, loadHistory, ask, clearHistory } from "../cloud/assistant";
import { buildContext, suggestions } from "../logic/assistant";
import { prefs } from "../prefs";
import { scroller } from "../nav";
import TG from "../tg";

const KEY = "golfcheck.assistantInsp";
const inTelegram = TG.active;
const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const opts = computed(() => [{ id: "none", name: "Без огляду" }].concat(list.value.map(i => ({ id: i.id, name: (i.name || apiOf(i).label(i.cfg)).slice(0, 28) }))));
const sel = ref((() => { try { const v = localStorage.getItem(KEY); return v && (v === "none" || db.inspections.some(i => i.id === v)) ? v : (list.value.find(i => !i.done) || { id: "none" }).id; } catch (e) { return "none"; } })());
const insp = computed(() => list.value.find(i => i.id === sel.value) || null);
const G = computed(() => (insp.value ? apiOf(insp.value) : null));
const text = ref("");
const hints = computed(() => suggestions(insp.value, G.value));
const ready = computed(() => auth.enabled && !!user.value);

function pick(_k, v) { sel.value = v; try { localStorage.setItem(KEY, v); } catch (e) { /* немає доступу */ } }
function context() {
  const i = insp.value; if (!i) return "";
  const rep = computeReport(i);
  return buildContext({ i, G: G.value, rep, stages: visibleStages(i), verdict: VERDICTS[rep.verdict].t });
}
async function toBottom() {
  await nextTick();
  const s = scroller(); if (s) s.scrollTo({ top: s.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
}
async function send(q) {
  const t = String(q || text.value).trim();
  if (!t || chat.streaming) return;
  text.value = "";
  TG.haptic("select");
  toBottom();
  await ask(t, { inspId: insp.value ? insp.value.id : null, context: context(), lang: prefs.lang });
  toBottom();
}
function onKey(e) {
  /* Enter надсилає лише з фізичної клавіатури; на телефоні Enter — новий рядок, надсилає кнопка. */
  if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover) and (pointer: fine)").matches) { e.preventDefault(); send(); }
}
function askClear() {
  sheet({ title: "Очистити цю розмову?", text: "Повідомлення видаляться з хмари. Помічник почне з чистого аркуша.", actions: [{ icon: "trash", label: "Очистити розмову", danger: true, fn: () => clearHistory(insp.value ? insp.value.id : null) }] });
}
async function load() { if (ready.value) { await loadHistory(insp.value ? insp.value.id : null); toBottom(); } }
watch(sel, load);
watch(ready, load);
watch(() => chat.messages.length && chat.messages[chat.messages.length - 1].content.length, () => { if (chat.streaming) toBottom(); });
onMounted(load);
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar root />
    <div class="content chat" :class="enter">
      <header class="page-head head-row">
        <div><p class="kicker">Відповідає на питання про огляд</p><h1 class="title">Помічник</h1></div>
        <ProfileButton />
      </header>

      <div v-if="CLOUD_ERROR" class="notice warn" data-notice="assistant-off"><AppIcon name="alert" /><div><b>Хмару налаштовано з помилкою</b>{{ CLOUD_ERROR }}. Помічник поки недоступний.</div></div>
      <div v-else-if="!auth.enabled" class="notice info" data-notice="assistant-off"><AppIcon name="alert" /><div><b>Помічник працює через хмару</b>Він з'явиться, коли адміністратор підключить Supabase і ключ OpenAI. Чек-лист і довідник працюють без нього.</div></div>
      <div v-else-if="!user" class="card account" data-notice="assistant-login">
        <p class="prose">Увійди через Telegram, щоб ставити запитання помічнику. Він бачить твій огляд і відповідає саме про це авто.</p>
        <button v-if="inTelegram" class="btn" data-action="login" :disabled="auth.busy" @click="loginMiniApp()"><AppIcon name="share" /><span>{{ auth.busy ? 'Входимо…' : 'Увійти через Telegram' }}</span></button>
        <TelegramLogin v-else />
      </div>

      <template v-else>
        <ChipGroup v-if="list.length" :list="opts" :sel="sel" k="insp" label="Про який огляд" @pick="pick" />
        <p v-if="insp" class="hint" data-context>Помічник бачить конфігурацію, відповіді й знайдені проблеми цього огляду.</p>

        <p v-if="chat.loading" class="foot" style="margin-top: var(--s4)">Завантаження розмови…</p>
        <section v-else-if="!chat.messages.length" class="chat-empty" aria-label="Підказки">
          <div class="empty-ic"><AppIcon name="sparkles" cls="lg" /></div>
          <h2 class="empty-t">Запитай про авто</h2>
          <p class="empty-s">Як перевірити вузол, чим загрожує знайдене, скільки торгуватися. Відповіді орієнтовні: помічник не бачить авто і не заміняє СТО.</p>
          <div class="chips" style="justify-content: center">
            <button v-for="h in hints" :key="h" class="chip" data-action="hint" @click="send(h)">{{ h }}</button>
          </div>
        </section>
        <ol v-else class="msgs" aria-live="polite" aria-label="Розмова">
          <li v-for="m in chat.messages" :key="m.id" class="msg" :class="[m.role === 'user' ? 'me' : 'ai', { pending: m.pending }]">
            <span v-if="m.role === 'assistant'" class="msg-ic" aria-hidden="true"><AppIcon name="sparkles" /></span>
            <div class="msg-b">{{ m.content || (m.pending ? 'Думаю…' : '') }}</div>
          </li>
        </ol>
        <p v-if="chat.error" class="notice bad" role="alert"><AppIcon name="alert" /><span>{{ chat.error }}</span></p>
        <div v-if="chat.messages.length" class="chat-foot">
          <span class="foot">{{ chat.remaining !== null ? 'Лишилося запитань сьогодні: ' + chat.remaining : 'Відповіді орієнтовні, перевіряй важливе на СТО.' }}</span>
          <button class="link" data-action="clear-chat" @click="askClear"><AppIcon name="trash" /><span>Очистити</span></button>
        </div>
      </template>
    </div>
  </AppScreen>

  <div v-if="ready" class="chat-bar">
    <div class="chat-bar-in">
      <label class="visually-hidden" for="chat-input">Запитання помічнику</label>
      <textarea id="chat-input" v-model="text" v-autosize class="textarea chat-input" rows="1" maxlength="1500" placeholder="Запитай про авто…" enterkeyhint="send" :disabled="chat.streaming" @keydown="onKey"></textarea>
      <button class="btn square" data-action="send" :disabled="chat.streaming || !text.trim()" aria-label="Надіслати" @click="send()"><AppIcon name="send" /></button>
    </div>
  </div>
</template>
