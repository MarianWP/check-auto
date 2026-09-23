<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppScreen from "../components/AppScreen.vue";
import NavBar from "../components/NavBar.vue";
import AppIcon from "../components/AppIcon.vue";
import SecTitle from "../components/SecTitle.vue";
import CfgLabel from "../components/CfgLabel.vue";
import PriceBlock from "../components/PriceBlock.vue";
import { insp, computeReport, VERDICTS, FULL_COVERAGE, money, fmtN, costStr, dateStr, apiOf } from "../store";
import { go } from "../nav";
import { share, confirmDelete } from "../actions";

const route = useRoute();
const i = insp(String(route.params.id));
const G = apiOf(i);
const rep = computed(() => computeReport(i));
const price = i.priceSnapshot || G.priceFor(i.cfg);
const V = computed(() => VERDICTS[rep.value.verdict]);
const rest = computed(() => rep.value.skipped.concat(rep.value.unanswered));
const groups = [["crit", "Критичні проблеми"], ["major", "Важливі зауваження"], ["minor", "Дрібниці"]];
const needPct = Math.round(FULL_COVERAGE * 100);
const fair = computed(() => {
  const r = rep.value;
  if (!i.price) return "";
  return " Від ціни " + money(i.price) + " справедливо просити " + money(Math.max(0, i.price - r.cost.hi)) + "–" + fmtN(Math.max(0, i.price - r.cost.lo)) + ".";
});
</script>

<template>
  <AppScreen v-slot="{ enter }">
    <NavBar back="/" back-label="мої огляди" :kicker="(i.name || G.model.full) + ' · ' + dateStr(i.updatedAt)"><template #title><CfgLabel :cfg="i.cfg" :model="G.id" /></template></NavBar>
    <div class="content" :class="enter">

      <!-- 1. Вердикт -->
      <section class="verdict" :class="'v-' + rep.verdict" :data-verdict="rep.verdict" aria-labelledby="h-verdict">
        <div class="verdict-top"><span class="verdict-ic"><AppIcon :name="V.icon" cls="lg" /></span><span>Вердикт</span></div>
        <h2 id="h-verdict" class="verdict-t">{{ V.t }}</h2>
        <p class="verdict-s">{{ V.s(rep) }}</p>
      </section>

      <!-- 2. Повнота: оцінка і кількість неперевіреного — однакової ваги, щоб бал не затьмарював прогалини -->
      <div class="tiles report-tiles" role="group" aria-label="Підсумок огляду">
        <div class="tile"><b class="tile-v big">{{ rep.score }}<span class="unit"> зі 100</span></b><span class="tile-l">Оцінка перевіреного</span></div>
        <div class="tile" :class="{ attention: rest.length > 0 }" data-tile="unchecked"><b class="tile-v big">{{ rest.length }}<span class="unit"> з {{ rep.total }}</span></b><span class="tile-l">Не перевірено</span></div>
        <div class="tile"><b class="tile-v big text-ok">{{ rep.ok }}</b><span class="tile-l">Без зауважень</span></div>
        <div class="tile"><b class="tile-v big" :class="{ 'text-bad': rep.failCount > 0 }">{{ rep.failCount }}</b><span class="tile-l">Проблем знайдено</span></div>
      </div>
      <section aria-labelledby="h-cov">
        <SecTitle id="h-cov" icon="gauge">Повнота огляду</SecTitle>
        <div class="card cov">
          <div class="cov-top"><span>Перевірено {{ rep.answered }} з {{ rep.total }} пунктів</span><b>{{ rep.pct }} %</b></div>
          <div class="progress" :class="{ complete: rep.complete }" role="progressbar" aria-label="Повнота огляду" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="rep.pct"><i :style="{ transform: 'scaleX(' + rep.coverage.toFixed(3) + ')' }"></i></div>
          <p class="foot">Критичних пунктів перевірено {{ rep.critChecked }} з {{ rep.critTotal }}. Вердикт «можна брати» можливий від {{ needPct }} % і коли перевірено всі критичні пункти.</p>
        </div>
      </section>
      <section v-if="rep.critUnchecked.length" aria-labelledby="h-critun">
        <SecTitle id="h-critun" icon="alert">Критичні пункти без перевірки · {{ rep.critUnchecked.length }}</SecTitle>
        <div class="group">
          <button v-for="x in rep.critUnchecked" :key="x.it.id" class="row" data-action="go" :data-to="'/check/' + i.id + '/' + x.si + '?item=' + encodeURIComponent(x.it.id)" @click="go('/check/' + i.id + '/' + x.si + '?item=' + encodeURIComponent(x.it.id))">
            <div class="row-main"><div class="row-t">{{ x.it.t }}</div><div class="row-s">Етап {{ x.si + 1 }}: {{ x.stage.short }}</div></div>
            <AppIcon name="chev" cls="chev" />
          </button>
        </div>
      </section>

      <!-- 3. Знайдені проблеми -->
      <template v-for="[k, title] in groups" :key="k">
        <section v-if="rep.fails[k].length" :aria-labelledby="'h-f-' + k">
          <SecTitle :id="'h-f-' + k" :icon="k === 'crit' ? 'circleX' : k === 'major' ? 'circleAlert' : 'minus'">{{ title }} · {{ rep.fails[k].length }}</SecTitle>
          <div class="group">
            <div v-for="f in rep.fails[k]" :key="f.it.id" class="rep-item">
              <h3 class="rep-t">{{ f.it.t }}</h3>
              <div v-if="f.a.tags && f.a.tags.length" class="tagline"><span v-for="t in f.a.tags" :key="t">{{ t }}</span></div>
              <!-- Те, що написав користувач: значок, підпис і власний фон, щоб не сплутати з текстом застосунку. -->
              <div v-if="f.a.c" class="user-note">
                <AppIcon name="comment" />
                <div class="user-note-body"><span class="user-note-l">Твій коментар</span><p class="user-note-t">{{ f.a.c }}</p></div>
              </div>
              <p class="rep-m">{{ f.stage.short }}<template v-if="f.it.cost && f.it.cost[1]"> · усунення ≈ {{ costStr(f.it.cost) }}</template></p>
            </div>
          </div>
        </section>
      </template>
      <section v-if="!rep.failCount" aria-labelledby="h-noprob">
        <SecTitle id="h-noprob" icon="circleCheck">Проблеми</SecTitle>
        <div class="card"><p class="prose">Серед перевірених пунктів проблем не зафіксовано.<template v-if="!rep.complete"> Огляд ще неповний, тож це не гарантія.</template><template v-else> Огляд повний — це дуже добрий знак.</template></p></div>
      </section>

      <!-- 4. Подробиці: бюджет, ринок, перелік неперевіреного -->
      <section v-if="rep.cost.hi > 0" aria-labelledby="h-budget">
        <SecTitle id="h-budget" icon="coins">Бюджет на усунення</SecTitle>
        <div class="card price">
          <div class="price-v">≈ {{ costStr([rep.cost.lo, rep.cost.hi]) }}</div>
          <p class="foot">Сума орієнтовних вартостей по знайдених проблемах. Це твій аргумент у торгу.{{ fair }}</p>
        </div>
      </section>
      <PriceBlock :i="i" :price="price" />
      <section v-if="rest.length" aria-labelledby="h-rest">
        <SecTitle id="h-rest" icon="circleDashed">Не перевірено · {{ rest.length }}</SecTitle>
        <div class="group">
          <details class="acc">
            <summary><span class="grow">Показати список</span><AppIcon name="chevDown" cls="turn" /></summary>
            <div class="acc-body"><ul class="list"><li v-for="x in rest" :key="x.it.id">{{ x.it.t }} <span class="muted">· {{ x.stage.short }}</span></li></ul></div>
          </details>
        </div>
      </section>

      <div class="btn-stack" style="margin-top: var(--s6)">
        <button class="btn" data-action="share" :data-id="i.id" @click="share(i.id)"><AppIcon name="share" /><span>Поділитися звітом</span></button>
        <button class="btn tonal" data-action="go" :data-to="'/check/' + i.id + '/0'" @click="go('/check/' + i.id + '/0')">Повернутись до чек-листа</button>
        <button class="btn ghost danger" data-action="delete" :data-id="i.id" @click="confirmDelete(i.id)"><AppIcon name="trash" /><span>Видалити огляд</span></button>
      </div>
      <p class="foot center" style="margin-top: var(--s4)">Звіт — орієнтир, а не експертиза. Для остаточного рішення покажи авто на СТО.</p>
    </div>
  </AppScreen>
</template>
