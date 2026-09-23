<script setup>
import { ref, computed, onMounted } from "vue";
import SaveStatus from "../components/SaveStatus.vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import PhotoStrip from "../components/PhotoStrip.vue";
import TG from "../tg";
import { photosFor } from "../cloud/content";
import { insp, visibleStages, stageProgress, clamp, costStr, apiOf, sheet, computeReport, setStage, reduced, SEV_LABEL as SEV, answer as saveAnswer, toggleTag as saveTag, setComment as saveComment, finish as finishInsp } from "../store";
import { go } from "../nav";

const route = useRoute();
const id = String(route.params.id);
const i = insp(id);
const G = apiOf(i);
/* Власні пункти з адмінки можуть з'явитися після завантаження, тому етапи — computed. */
const stages = computed(() => visibleStages(i));
const n = clamp(parseInt(route.params.n || "0", 10) || 0, 0, stages.value.length - 1);
setStage(i, n);
const st = computed(() => stages.value[n]);
const tags = G.tagsFor(i.cfg), last = n === stages.value.length - 1;
const prog = computed(() => stageProgress(i, stages.value));
const overallPct = computed(() => { const p = prog.value; const total = p.reduce((s, x) => s + x.total, 0); return total ? Math.round(p.reduce((s, x) => s + x.answered, 0) / total * 100) : 0; });
const cur = computed(() => prog.value[n]);
/* Статус «skip» у сховищі лишається незмінним; у інтерфейсі це «Не перевірено». */
const ANSWERS = [{ s: "ok", label: "Ок", icon: "check" }, { s: "bad", label: "Проблема", icon: "x" }, { s: "skip", label: "Не перевірено", icon: "minus" }];

const ans = it => i.answers[it.id] || {};
const hasTag = (it, t) => { const a = ans(it); return !!(a.tags && a.tags.includes(t)); };
const noteTags = it => Object.keys(it.notes || {}).filter(t => tags.has(t));
const costWhy = it => it.cost && it.cost[1] ? " Орієнтовна вартість усунення: " + costStr(it.cost) + "." : "";
const stageCls = k => { const p = prog.value[k]; return k === n ? "current" : p.answered >= p.total ? "done" : p.answered ? "part" : ""; };
const stageDone = k => k !== n && prog.value[k].answered >= prog.value[k].total;
const stageHint = k => { const p = prog.value[k]; return stages.value[k].name + ": " + p.answered + " з " + p.total; };
function answer(it, s) { saveAnswer(i, it.id, s); TG.haptic("light"); }
function toggleTag(it, t) { saveTag(i, it.id, t); TG.haptic("select"); }
function setComment(it, ev) { saveComment(i, it.id, ev.target.value); }
const filter = ref("all");
const filters = [{ id: "all", label: "Усі" }, { id: "bad", label: "Проблеми" }, { id: "unchecked", label: "Не перевірено" }];
const shown = computed(() => st.value.items.filter(it => filter.value === "all" || (filter.value === "bad" ? ans(it).s === "bad" : !["ok", "bad"].includes(ans(it).s))));
const nextUnchecked = computed(() => {
  const order = stages.value.map((s, si) => ({ s, si }));
  for (const { s, si } of order.slice(n).concat(order.slice(0, n))) {
    const it = s.items.find(it => !["ok", "bad"].includes(ans(it).s));
    if (it) return { si, it };
  }
  return null;
});
function focusItem(itemId) {
  const el = document.getElementById("check-item-" + itemId);
  if (el) { el.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" }); el.focus({ preventScroll: true }); }
}
function jumpUnchecked() {
  const next = nextUnchecked.value;
  if (!next) return;
  const to = "/check/" + id + "/" + next.si + "?item=" + encodeURIComponent(next.it.id);
  if (route.fullPath === to) focusItem(next.it.id); else go(to);
}
function finish() {
  const complete = () => { finishInsp(i); go("/report/" + id); };
  const rep = computeReport(i);
  if (!rep.critUnchecked.length) { complete(); return; }
  sheet({ title: "Є неперевірені критичні пункти", text: "Залишилося: " + rep.critUnchecked.length + ". Можна продовжити перевірку або сформувати проміжний звіт.", actions: [
    { label: "Продовжити перевірку", fn: jumpUnchecked }, { label: "Сформувати проміжний звіт", fn: complete }
  ] });
}
onMounted(() => {
  const c = document.querySelector("#stages .stage.current");
  if (c?.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "center" });
  if (route.query.item) focusItem(String(route.query.item));
});
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <!-- Липка шапка: номер етапу, прогрес і смужка етапів завжди під рукою; назва й опис етапу скролять із контентом. -->
    <NavBar :back="'/car/' + id" back-label="картка авто" :title="'Етап ' + (n + 1) + ' з ' + stages.length" title-tag="div">
      <template #right><span class="topbar-meta num">{{ overallPct }} % перевірено</span></template>
      <template #extra>
        <div class="progress thin" role="progressbar" aria-label="Загальний прогрес огляду" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="overallPct"><i id="prog" :style="{ transform: 'scaleX(' + (overallPct / 100).toFixed(3) + ')' }"></i></div>
        <nav id="stages" class="stages" aria-label="Етапи огляду">
          <button v-for="(s, k) in stages" :key="s.id" class="stage" :class="stageCls(k)" data-action="stage" :data-to="'/check/' + id + '/' + k" :aria-current="k === n ? 'step' : null" :aria-label="stageHint(k)" @click="go('/check/' + id + '/' + k)">
            <span class="stage-no"><AppIcon v-if="stageDone(k)" name="check" /><template v-else>{{ k + 1 }}</template></span><span>{{ s.short }}</span>
          </button>
        </nav>
      </template>
    </NavBar>

    <div class="content" :class="enter">
      <header class="page-head stage-head">
        <p class="kicker">{{ G.model.name }} · {{ G.engine(i.cfg.engine).name }} · {{ i.cfg.year }}</p>
        <h1 class="title">{{ st.name }}</h1>
        <p class="lead">{{ st.intro }}</p>
      </header>

      <SaveStatus />
      <div class="check-tools">
        <div class="chips" role="group" aria-label="Фільтр пунктів"><button v-for="f in filters" :key="f.id" class="chip" :class="{ on: filter === f.id }" :aria-pressed="filter === f.id" @click="filter = f.id">{{ f.label }}</button></div>
        <button v-if="nextUnchecked" class="link" @click="jumpUnchecked">До неперевіреного пункту <AppIcon name="arrowRight" /></button>
      </div>
      <p v-if="!shown.length" class="notice info">На цьому етапі немає пунктів за цим фільтром.</p>
      <div class="items">
        <article v-for="it in shown" :id="'check-item-' + it.id" :key="it.id" tabindex="-1" class="item" :data-item="it.id" :data-s="ans(it).s || ''">
          <div class="item-top">
            <span class="sev" :class="'sev-' + it.sev"><AppIcon v-if="it.sev === 'crit'" name="alert" />{{ SEV[it.sev] }}</span>
            <span class="item-idx num">{{ st.items.indexOf(it) + 1 }} з {{ st.items.length }}</span>
          </div>
          <h2 class="item-t">{{ it.t }}</h2>
          <p class="how">{{ it.how }}</p>
          <div v-for="t in noteTags(it)" :key="t" class="note"><AppIcon name="alert" /><span>{{ it.notes[t] }}</span></div>
          <PhotoStrip :photos="photosFor('item', it.id, 0)" />
          <details v-if="it.why || (it.cost && it.cost[1])" class="why">
            <summary><span>Чому це важливо</span><AppIcon name="chevDown" cls="turn" /></summary>
            <p>{{ it.why }}{{ costWhy(it) }}</p>
          </details>

          <div class="answers" role="group" :aria-label="'Результат: ' + it.t">
            <button v-for="a in ANSWERS" :key="a.s" class="ans" :class="['ans-' + a.s, { on: ans(it).s === a.s }]" data-action="answer" :data-s="a.s" :aria-pressed="ans(it).s === a.s" @click="answer(it, a.s)">
              <span class="ans-ic"><AppIcon :name="a.icon" /></span><span>{{ a.label }}</span>
            </button>
          </div>

          <transition name="comment">
            <div v-show="ans(it).s === 'bad'" class="comment">
              <div v-if="it.tags && it.tags.length">
                <span :id="'tags-' + it.id" class="field-label">Що саме не так</span>
                <div class="chips" role="group" :aria-labelledby="'tags-' + it.id">
                  <button v-for="t in it.tags" :key="t" class="chip tag" :class="{ on: hasTag(it, t) }" data-action="tag" :data-t="t" :aria-pressed="hasTag(it, t)" @click="toggleTag(it, t)">
                    <AppIcon v-if="hasTag(it, t)" name="check" /><span>{{ t }}</span>
                  </button>
                </div>
              </div>
              <label class="field">
                <span class="field-label">Коментар для звіту</span>
                <textarea v-autosize class="textarea" data-action="comment" rows="3" maxlength="500" placeholder="Де саме, наскільки сильно, що каже продавець" :value="ans(it).c || ''" @input="setComment(it, $event)"></textarea>
              </label>
            </div>
          </transition>
        </article>
      </div>
    </div>
  </AppScreen>

  <div id="bar" class="bar">
    <div class="bar-in">
      <p class="bar-status"><span>Перевірено · пропущено {{ cur.skipped }}</span><b class="num">{{ cur.answered }} з {{ cur.total }}</b></p>
      <div class="bar-actions">
        <button v-if="n > 0" class="btn tonal square" data-action="prev" :data-to="'/check/' + id + '/' + (n - 1)" :aria-label="'Попередній етап: ' + stages[n - 1].short" @click="go('/check/' + id + '/' + (n - 1))"><AppIcon name="arrowLeft" /></button>
        <button class="btn" :data-action="last ? 'finish' : 'next'" :data-to="last ? null : '/check/' + id + '/' + (n + 1)" @click="last ? finish() : go('/check/' + id + '/' + (n + 1))">
          <span>{{ last ? 'Сформувати звіт' : 'Далі: ' + stages[n + 1].short }}</span><AppIcon name="arrowRight" />
        </button>
      </div>
    </div>
  </div>
</template>
