<script setup>
import AppIcon from "./AppIcon.vue";
import SecTitle from "./SecTitle.vue";
import IssueRow from "./IssueRow.vue";
import { modelApi } from "../data/index.js";
import { photosFor } from "../cloud/content";

const props = defineProps({ model: { type: String, default: "golf5" } });
const G = modelApi(props.model);
const list = G.COMMON;
</script>

<template>
  <section id="sec-common" class="anchor" aria-labelledby="h-common">
    <SecTitle id="h-common" icon="stethoscope">Спільні хвороби {{ G.model.name }}</SecTitle>
    <div class="group">
      <details class="acc">
        <summary><AppIcon name="wrench" /><span class="grow">Кузов, електрика, підвіска</span><span class="muted">{{ list.length }}</span><AppIcon name="chevDown" cls="turn" /></summary>
        <IssueRow v-for="(x, k) in list" :key="k" :x="x" :photos="photosFor('common', model, k)" />
      </details>
    </div>
  </section>
</template>
