<script setup>
/* Помічник ШІ: чат про огляд. Контекст — обраний огляд (типово останній незавершений) або без огляду.
   Працює лише з хмарою і після входу; без них екран чесно пояснює, чого бракує. */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import ProfileButton from "../components/ProfileButton.vue";
import TelegramLogin from "../components/TelegramLogin.vue";
import AiThinking from "../components/AiThinking.vue";
import AiText from "../components/AiText.vue";
import { db, apiOf, computeReport, visibleStages, VERDICTS, sheet, reduced, account, toast, openLightbox } from "../store";
import { auth, user, loginMiniApp } from "../cloud/auth";
import { CLOUD_ERROR } from "../cloud/client";
import { chat, loadHistory, ask, clearHistory, cancelAsk, loadOlder } from "../cloud/assistant";
import { buildContext, suggestions, focusContext, focusQuestion, PHOTO_QUESTION } from "../logic/assistant";
import { chatPhoto } from "../image";
import { prefs } from "../prefs";
import { scroller, back } from "../nav";
import TG from "../tg";

const KEY = "golfcheck.assistantInsp:" + account.scope;
const inTelegram = TG.active;
const list = computed(() => db.inspections.slice().sort((a, b) => b.updatedAt - a.updatedAt));
const nameOf = i => i.name || apiOf(i).label(i.cfg);
const pickLabel = computed(() => (insp.value ? nameOf(insp.value) : "Без огляду"));
const sel = ref((() => { try { const v = localStorage.getItem(KEY); return v && (v === "none" || db.inspections.some(i => i.id === v)) ? v : (list.value.find(i => !i.done) || { id: "none" }).id; } catch (e) { return "none"; } })());
const insp = computed(() => list.value.find(i => i.id === sel.value) || null);
const G = computed(() => (insp.value ? apiOf(insp.value) : null));
const text = ref("");
const hints = computed(() => suggestions(insp.value, G.value));
const ready = computed(() => auth.enabled && !!user.value);
/* Фото до запитання ({ image, thumb }) і пункт чек-листа, з якого прийшли кнопкою «Перевірити з помічником». */
const photo = ref(null);
const photoBusy = ref(false);
const focus = ref(null);
const route = useRoute();

function pick(v) { sel.value = v; try { localStorage.setItem(KEY, v); } catch (e) { /* немає доступу */ } }
/* Вибір огляду в аркуші знизу: компактно, скільки б оглядів не було. */
function openPicker() {
  const opt = (id, label, sub, icon) => ({ label, sub, icon, on: sel.value === id, fn: () => pick(id) });
  sheet({ title: "Про який огляд запитуємо", actions: [opt("none", "Без огляду", "Загальні питання", "comment")].concat(list.value.map(i => opt(i.id, nameOf(i), apiOf(i).model.name + " · " + apiOf(i).label(i.cfg) + (i.done ? " · завершено" : ""), "car"))) });
}
function context() {
  const i = insp.value; if (!i) return "";
  const rep = computeReport(i);
  const ctx = buildContext({ i, G: G.value, rep, stages: visibleStages(i), verdict: VERDICTS[rep.verdict].t });
  /* Пункт — першим рядком, щоб не загубився, якщо контекст доведеться обрізати. */
  return focus.value ? focusContext(focus.value) + "\n\n" + ctx : ctx;
}
/* Прийшли з чек-листа (?insp=…&item=…): обираємо цей огляд, запам'ятовуємо пункт і підставляємо запитання. */
function applyFocus() {
  const iid = String(route.query.insp || ""), itemId = String(route.query.item || "");
  const i = iid && db.inspections.find(x => x.id === iid);
  if (!i) return;
  pick(iid);
  const it = itemId && visibleStages(i).flatMap(s => s.items).find(x => x.id === itemId);
  if (!it) return;
  focus.value = { id: it.id, t: it.t, how: it.how, why: it.why };
  if (!text.value) text.value = focusQuestion(it);
}
async function onPhoto(ev) {
  const input = ev.target, file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  photoBusy.value = true;
  try { photo.value = await chatPhoto(file); }
  catch (e) { toast("Не вдалося відкрити фото" + (e && e.message ? ": " + e.message : ""), 3500); }
  finally { photoBusy.value = false; }
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
  /* Лише фото без тексту — теж запитання: помічник опише, що на ньому, і чи є проблема. */
  const t = String(q || text.value).trim() || (photo.value ? PHOTO_QUESTION : "");
  if (!t || photoBusy.value || chat.streaming || chat.loading || chat.refreshing) return;
  const p = photo.value;
  text.value = ""; photo.value = null;
  TG.haptic("select");
  toBottom();
  const selected = sel.value;
  const ok = await ask(t, { inspId: insp.value ? insp.value.id : null, context: context(), lang: prefs.lang, image: p ? p.image : undefined, thumb: p ? p.thumb : undefined });
  if (!ok && sel.value === selected) { if (!text.value) text.value = t; if (!photo.value && p) photo.value = p; }
}
function retry() { if (chat.retryPhoto && !photo.value) photo.value = chat.retryPhoto; send(chat.retryText); }
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
applyFocus();
watch(sel, load);
/* Інший огляд — пункт попереднього вже ні до чого. */
watch(sel, () => { focus.value = null; });
watch(ready, load);
watch(() => chat.messages.length && chat.messages[chat.messages.length - 1].content.length, () => { if (chat.streaming) followReply(); });
onMounted(() => { scrollElement = scroller(); scrollElement?.addEventListener("scroll", onScroll, { passive: true }); load(); });
onBeforeUnmount(() => { cancelAsk(); cancelAnimationFrame(frame); focusTimers.forEach(clearTimeout); scrollElement?.removeEventListener("scroll", onScroll); });
</script>

<template>
  <AppScreen class="chat-screen" v-slot="{ enter, scrolled }">
    <NavBar root />
    <div class="content chat" :class="enter">
      <header class="page-head head-row chat-head" :class="{ stuck: scrolled }">
        <h1 class="title">Помічник</h1>
        <ProfileButton />
      </header>

      <div v-if="CLOUD_ERROR" class="notice warn" data-notice="assistant-off"><AppIcon name="alert" /><div><b>Хмару налаштовано з помилкою</b>{{ CLOUD_ERROR }}. Помічник поки недоступний.</div></div>
      <div v-else-if="!auth.enabled" class="notice info" data-notice="assistant-off"><AppIcon name="alert" /><div><b>Помічник недоступний</b>Хмару ще не підключено.</div></div>
      <div v-else-if="!user" class="card account" data-notice="assistant-login">
        <p class="prose">Увійди, щоб питати про своє авто</p>
        <button v-if="inTelegram" class="btn" data-action="login" :disabled="auth.busy" @click="loginMiniApp()"><AppIcon name="share" /><span>{{ auth.busy ? 'Входимо…' : 'Увійти через Telegram' }}</span></button>
        <TelegramLogin v-else />
      </div>

      <template v-else>
        <div v-if="list.length" class="group picker">
          <button class="row" data-action="pick-insp" :aria-label="'Про який огляд: ' + pickLabel" @click="openPicker">
            <AppIcon name="car" />
            <div class="row-main"><div class="row-s">Про який огляд</div><div class="row-t" data-pick-label>{{ pickLabel }}</div></div>
            <AppIcon name="chevDown" cls="chev" />
          </button>
        </div>

        <div v-if="focus" class="card focus-card" data-focus-item>
          <div class="focus-top"><AppIcon name="clipboard" /><span class="focus-l">Перевіряємо пункт</span><button class="icon-btn" aria-label="Не прив'язувати до пункту" @click="focus = null"><AppIcon name="x" /></button></div>
          <p class="focus-t">{{ focus.t }}</p>
          <button class="link" @click="back('/check/' + sel)"><AppIcon name="arrowLeft" /><span>До чек-листа</span></button>
        </div>

        <p v-if="chat.loading && !chat.messages.length" class="foot" style="margin-top: var(--s4)">Завантаження розмови…</p>
        <section v-else-if="!chat.messages.length" class="chat-empty" aria-label="Підказки">
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
            <div v-else class="msg-b"><button v-if="typeof m.photo === 'string'" class="msg-photo" aria-label="Фото до запитання" @click="openLightbox(m.photoFull || m.photo)"><img :src="m.photo" alt=""></button><span v-else-if="m.photo" class="msg-photo-tag"><AppIcon name="image" cls="sm" />Фото</span><AiText v-if="m.role === 'assistant'" :text="m.content" :live="!!m.pending" /><template v-else>{{ m.content }}</template></div>
            <p v-if="m.failed || m.interrupted" class="foot">{{ m.failed ? 'Не вдалося надіслати' : 'Відповідь перервана' }}</p>
          </li>
        </ol>
        <p v-if="chat.error" class="notice bad" role="alert"><AppIcon name="alert" /><span>{{ chat.error }}</span></p>
        <button v-if="chat.retryText && !chat.streaming" class="link" @click="retry">Повторити запитання</button>
        <button v-if="hasNew" class="btn tonal" @click="toBottom">Нові повідомлення ↓</button>
        <div v-if="chat.messages.length" class="chat-foot">
          <span class="foot">{{ chat.stale ? 'Показано збережену розмову: хмара не відповіла' : chat.remaining !== null ? 'Лишилося запитань сьогодні: ' + chat.remaining : 'Відповіді орієнтовні, перевіряй важливе на СТО.' }}</span>
          <button class="link" data-action="clear-chat" :disabled="chat.streaming || chat.loading || chat.refreshing" @click="askClear"><AppIcon name="trash" /><span>Очистити</span></button>
        </div>
      </template>
    </div>
  </AppScreen>

  <div v-if="ready" class="chat-bar">
    <div v-if="photo" class="chat-attached">
      <button class="chat-attached-img" aria-label="Переглянути фото" @click="openLightbox(photo.image)"><img :src="photo.thumb" alt=""></button>
      <span class="chat-attached-l">Фото до запитання</span>
      <button class="icon-btn" aria-label="Прибрати фото" @click="photo = null"><AppIcon name="x" /></button>
    </div>
    <div class="chat-bar-in">
      <!-- Вибір фото: камера або галерея (на iPhone система сама запропонує обидва варіанти). -->
      <label class="btn square tonal chat-attach" :class="{ hint: focus && !photo, busy: photoBusy }">
        <AppIcon name="image" />
        <input class="visually-hidden" type="file" accept="image/*" aria-label="Додати фото" :disabled="chat.streaming || photoBusy" @change="onPhoto">
      </label>
      <label class="visually-hidden" for="chat-input">Запитання помічнику</label>
      <textarea id="chat-input" v-model="text" v-autosize class="textarea chat-input" rows="1" maxlength="1500" placeholder="Запитай про авто…" enterkeyhint="send" :disabled="chat.streaming" @keydown="onKey" @focus="onFocus"></textarea>
      <button v-if="chat.streaming" class="btn square tonal" aria-label="Зупинити відповідь" @click="cancelAsk"><AppIcon name="x" /></button>
      <button v-else class="btn square" data-action="send" :disabled="chat.loading || chat.refreshing || photoBusy || (!text.trim() && !photo)" aria-label="Надіслати" @click="send()"><AppIcon name="send" /></button>
    </div>
  </div>
</template>
