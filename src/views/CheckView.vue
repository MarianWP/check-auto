<script setup>
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import G from "../data/golf";
import TG from "../tg";
import { insp, visibleStages, stageProgress, clamp, costStr, SEV_LABEL as SEV, answer as saveAnswer, toggleTag as saveTag, setComment as saveComment, finish as finishInsp } from "../store";
import { go } from "../nav";

const route = useRoute();
const id = String(route.params.id);
const i = insp(id);
const stages = visibleStages(i);
const n = clamp(parseInt(route.params.n || "0", 10) || 0, 0, stages.length - 1);
if (i.stage !== n) i.stage = n;
const st = stages[n], tags = G.tagsFor(i.cfg), last = n === stages.length - 1;
const prog = computed(() => stageProgress(i, stages));
const overall = computed(() => { const p = prog.value; return p.reduce((s, x) => s + x.answered, 0) / p.reduce((s, x) => s + x.total, 0); });
const cur = computed(() => prog.value[n]);
const ANSWERS = [{ s: "ok", label: "Ок", icon: "check" }, { s: "bad", label: "Проблема", icon: "x" }, { s: "skip", label: "Пропустити", icon: "minus" }];

const ans = it => i.answers[it.id] || {};
const hasTag = (it, t) => { const a = ans(it); return !!(a.tags && a.tags.includes(t)); };
const noteTags = it => Object.keys(it.notes || {}).filter(t => tags.has(t));
const costWhy = it => it.cost && it.cost[1] ? " Орієнтовна вартість усунення: " + costStr(it.cost) + "." : "";
const stageCls = k => { const p = prog.value[k]; return k === n ? "current" : p.answered >= p.total ? "done" : p.answered ? "part" : ""; };
const stageDone = k => k !== n && prog.value[k].answered >= prog.value[k].total;
function answer(it, s) { saveAnswer(i, it.id, s); TG.haptic("light"); }
function toggleTag(it, t) { saveTag(i, it.id, t); TG.haptic("select"); }
function setComment(it, ev) { saveComment(i, it.id, ev.target.value); }
function finish() { finishInsp(i); go("/report/" + id); }
onMounted(() => { const c = document.querySelector("#stages .stage.current"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "center" }); });
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar :back="'/car/' + id" back-label="Картка" :title="st.name" :sub="'Етап ' + (n + 1) + ' з ' + stages.length">
      <template #extra><div class="progress"><i id="prog" :style="{ transform: 'scaleX(' + overall.toFixed(3) + ')' }"></i></div></template>
    </NavBar>
    <div id="stages" class="stages">
      <button v-for="(s, k) in stages" :key="s.id" class="stage" :class="stageCls(k)" data-action="go" :data-to="'/check/' + id + '/' + k" :aria-current="k === n" @click="go('/check/' + id + '/' + k)">
        <b><AppIcon v-if="stageDone(k)" name="check" /><template v-else>{{ k + 1 }}</template></b>{{ s.short }}
      </button>
    </div>
    <div class="content" :class="enter">
      <div class="intro"><AppIcon name="info" /><span>{{ st.intro }}</span></div>
      <div class="items">
        <article v-for="(it, k) in st.items" :key="it.id" class="item" :data-item="it.id" :data-s="ans(it).s || ''">
          <div class="item-top"><span class="item-idx">{{ k + 1 }}</span><span class="sev" :class="'sev-' + it.sev">{{ SEV[it.sev] }}</span></div>
          <h3 class="item-t">{{ it.t }}</h3>
          <p class="how">{{ it.how }}</p>
          <div v-for="t in noteTags(it)" :key="t" class="note"><AppIcon name="alert" /><span>{{ it.notes[t] }}</span></div>
          <details class="why"><summary><AppIcon name="chev" cls="sm" /> Чому це важливо</summary><p>{{ it.why }}{{ costWhy(it) }}</p></details>
          <div class="answers" role="group" aria-label="Результат перевірки">
            <button v-for="a in ANSWERS" :key="a.s" class="ans" :class="['ans-' + a.s, { on: ans(it).s === a.s }]" data-action="answer" :data-s="a.s" :aria-pressed="ans(it).s === a.s" @click="answer(it, a.s)"><AppIcon :name="a.icon" /><span>{{ a.label }}</span></button>
          </div>
          <transition name="comment">
            <div v-show="ans(it).s === 'bad'" class="comment">
              <div v-if="it.tags && it.tags.length" class="chips tags">
                <button v-for="t in it.tags" :key="t" class="chip small tag" :class="{ on: hasTag(it, t) }" data-action="tag" :data-t="t" :aria-pressed="hasTag(it, t)" @click="toggleTag(it, t)">{{ t }}</button>
              </div>
              <textarea v-autosize class="textarea" data-action="comment" rows="2" maxlength="500" placeholder="Що саме не так? Коротко, для звіту" :value="ans(it).c || ''" @input="setComment(it, $event)"></textarea>
            </div>
          </transition>
        </article>
      </div>
    </div>
  </AppScreen>
  <div id="bar" class="bar">
    <div class="bar-in">
      <div class="bar-status">
        <span>Відповіли <b class="num">{{ cur.answered }} з {{ cur.total }}</b></span>
        <button v-if="n > 0" class="btn ghost sm" data-action="go" :data-to="'/check/' + id + '/' + (n - 1)" @click="go('/check/' + id + '/' + (n - 1))"><AppIcon name="back" cls="sm" /><span>{{ stages[n - 1].short }}</span></button>
      </div>
      <button class="btn" :data-action="last ? 'finish' : 'go'" :data-to="last ? null : '/check/' + id + '/' + (n + 1)" @click="last ? finish() : go('/check/' + id + '/' + (n + 1))"><span>{{ last ? 'Сформувати звіт' : 'Далі: ' + stages[n + 1].short }}</span><AppIcon name="chev" /></button>
    </div>
  </div>
</template>
