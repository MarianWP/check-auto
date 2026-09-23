<script setup>
/* Помічник ШІ: чат про огляд. Контекст — обраний огляд (типово останній незавершений) або без огляду.
   Працює лише з хмарою і після входу; без них екран чесно пояснює, чого бракує. */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import ProfileButton from "../components/ProfileButton.vue";
import TelegramLogin from "../components/TelegramLogin.vue";
import AiThinking from "../components/AiThinking.vue";
import AiText from "../components/AiText.vue";
import { db, apiOf, computeReport, visibleStages, VERDICTS, sheet, reduced, account } from "../store";
import { auth, user, loginMiniApp } from "../cloud/auth";
import { CLOUD_ERROR } from "../cloud/client";
import { chat, loadHistory, ask, clearHistory, cancelAsk, loadOlder } from "../cloud/assistant";
import { buildContext, suggestions } from "../logic/assistant";
import { prefs } from "../prefs";
import { scroller } from "../nav";
import TG from "../tg";

const KEY = "golfcheck.assistantInsp:" + account.scope;
const inTelegram = TG.active;
const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const nameOf = i => i.name || apiOf(i).label(i.cfg);
const pickLabel = computed(() => (insp.value ? nameOf(insp.value) : "Без огляду"));
const pickSub = computed(() => (insp.value ? apiOf(insp.value).model.name + " · " + apiOf(insp.value).label(insp.value.cfg) : "Загальні питання про огляд і покупку"));
const sel = ref((() => { try { const v = localStorage.getItem(KEY); return v && (v === "none" || db.inspections.some(i => i.id === v)) ? v : (list.value.find(i => !i.done) || { id: "none" }).id; } catch (e) { return "none"; } })());
const insp = computed(() => list.value.find(i => i.id === sel.value) || null);
const G = computed(() => (insp.value ? apiOf(insp.value) : null));
const text = ref("");
const hints = computed(() => suggestions(insp.value, G.value));
const ready = computed(() => auth.enabled && !!user.value);

function pick(v) { sel.value = v; try { localStorage.setItem(KEY, v); } catch (e) { /* немає доступу */ } }
/* Вибір огляду в аркуші знизу: компактно, скільки б оглядів не було. */
function openPicker() {
  const opt = (id, label, sub, icon) => ({ label, sub, icon, on: sel.value === id, fn: () => pick(id) });
  sheet({ title: "Про який огляд запитуємо", actions: [opt("none", "Без огляду", "Загальні питання", "comment")].concat(list.value.map(i => opt(i.id, nameOf(i), apiOf(i).model.name + " · " + apiOf(i).label(i.cfg) + (i.done ? " · завершено" : ""), "car"))) });
}
function context() {
  const i = insp.value; if (!i) return "";
  const rep = computeReport(i);
  return buildContext({ i, G: G.value, rep, stages: visibleStages(i), verdict: VERDICTS[rep.verdict].t });
}
const atBottom = ref(true);
const hasNew = ref(false);
let frame = 0, scrollElement = null;
const focusTimers = [];
function onScroll() {
  const s = scroller();
  if (s) atBottom.value = s.scrollHeight - s.scrollTop - s.clientHeight < 100;
  if (atBottom.value) hasNew.value = false;
}
function followReply() {
  if (!atBottom.value) { hasNew.value = true; return; }
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; const s = scroller(); if (s) s.scrollTop = s.scrollHeight; });
}
async function older() {
  const s = scroller(), height = s?.scrollHeight || 0, top = s?.scrollTop || 0;
  await loadOlder(); await nextTick();
  if (s) s.scrollTop = top + s.scrollHeight - height;
}
async function toBottom() {
  atBottom.value = true; hasNew.value = false;
  await nextTick();
  const s = scroller(); if (s) s.scrollTo({ top: s.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
}
async function send(q) {
  const t = String(q || text.value).trim();
  if (!t || chat.streaming || chat.loading || chat.refreshing) return;
  text.value = "";
  TG.haptic("select");
  toBottom();
  const selected = sel.value;
  const ok = await ask(t, { inspId: insp.value ? insp.value.id : null, context: context(), lang: prefs.lang });
  if (!ok && sel.value === selected && !text.value) text.value = t;
}
/* Клавіатура відкривається з затримкою: прокручуємо чат до останніх повідомлень, щойно вона стане на місце. */
function onFocus() { focusTimers.push(setTimeout(toBottom, 350)); }
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
watch(() => chat.messages.length && chat.messages[chat.messages.length - 1].content.length, () => { if (chat.streaming) followReply(); });
onMounted(() => { scrollElement = scroller(); scrollElement?.addEventListener("scroll", onScroll, { passive: true }); load(); });
onBeforeUnmount(() => { cancelAsk(); cancelAnimationFrame(frame); focusTimers.forEach(clearTimeout); scrollElement?.removeEventListener("scroll", onScroll); });
</script>

<template>
  <AppScreen class="chat-screen" v-slot="{ enter }">
    <NavBar root />
    <div class="content chat" :class="enter">
      <header class="page-head head-row">
        <div><p class="kicker">ШІ про огляд і покупку</p><h1 class="title">Помічник</h1></div>
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
        <div v-if="list.length" class="group picker">
          <button class="row" data-action="pick-insp" :aria-label="'Про який огляд: ' + pickLabel" @click="openPicker">
            <AppIcon name="car" />
            <div class="row-main"><div class="row-s">Про який огляд</div><div class="row-t" data-pick-label>{{ pickLabel }}</div><div v-if="insp" class="row-s">{{ pickSub }}</div></div>
            <AppIcon name="chevDown" cls="chev" />
          </button>
        </div>

        <p v-if="chat.loading && !chat.messages.length" class="foot" style="margin-top: var(--s4)">Завантаження розмови…</p>
        <section v-else-if="!chat.messages.length" class="chat-empty" aria-label="Підказки">
          <p class="empty-s">Як перевірити вузол, чим загрожує знайдене, скільки торгуватися. Відповіді орієнтовні: помічник не бачить авто і не заміняє СТО.</p>
          <div class="chips">
            <button v-for="h in hints" :key="h" class="chip" data-action="hint" @click="send(h)">{{ h }}</button>
          </div>
        </section>
        <button v-if="chat.hasMore" class="link" :disabled="chat.loading || chat.streaming" @click="older">{{ chat.loading ? 'Завантаження…' : 'Попередні повідомлення' }}</button>
        <ol v-if="chat.messages.length" class="msgs" aria-live="polite" aria-label="Розмова">
          <li v-for="m in chat.messages" :key="m.id" class="msg" :class="[m.role === 'user' ? 'me' : 'ai', { pending: m.pending }]">
            <!-- Поки відповідь ще не почалася: анімований контур замість іконки і текст із мерехтінням; далі текст без бульбашки. -->
            <span v-if="m.role === 'assistant' && !(m.pending && !m.content)" class="msg-ic" aria-hidden="true"><AppIcon name="sparkles" /></span>
            <AiThinking v-if="m.pending && !m.content" />
            <div v-else class="msg-b"><AiText v-if="m.role === 'assistant'" :text="m.content" :live="!!m.pending" /><template v-else>{{ m.content }}</template></div>
            <p v-if="m.failed || m.interrupted" class="foot">{{ m.failed ? 'Не вдалося надіслати' : 'Відповідь перервана' }}</p>
          </li>
        </ol>
        <p v-if="chat.error" class="notice bad" role="alert"><AppIcon name="alert" /><span>{{ chat.error }}</span></p>
        <button v-if="chat.retryText && !chat.streaming" class="link" @click="send(chat.retryText)">Повторити запитання</button>
        <button v-if="hasNew" class="btn tonal" @click="toBottom">Нові повідомлення ↓</button>
        <div v-if="chat.messages.length" class="chat-foot">
          <span class="foot">{{ chat.stale ? 'Показано збережену розмову: хмара не відповіла' : chat.remaining !== null ? 'Лишилося запитань сьогодні: ' + chat.remaining : 'Відповіді орієнтовні, перевіряй важливе на СТО.' }}</span>
          <button class="link" data-action="clear-chat" :disabled="chat.streaming || chat.loading || chat.refreshing" @click="askClear"><AppIcon name="trash" /><span>Очистити</span></button>
        </div>
      </template>
    </div>
  </AppScreen>

  <div v-if="ready" class="chat-bar">
    <div class="chat-bar-in">
      <label class="visually-hidden" for="chat-input">Запитання помічнику</label>
      <textarea id="chat-input" v-model="text" v-autosize class="textarea chat-input" rows="1" maxlength="1500" placeholder="Запитай про авто…" enterkeyhint="send" :disabled="chat.streaming" @keydown="onKey" @focus="onFocus"></textarea>
      <button v-if="chat.streaming" class="btn square tonal" aria-label="Зупинити відповідь" @click="cancelAsk"><AppIcon name="x" /></button>
      <button v-else class="btn square" data-action="send" :disabled="chat.loading || chat.refreshing || !text.trim()" aria-label="Надіслати" @click="send()"><AppIcon name="send" /></button>
    </div>
  </div>
</template>
