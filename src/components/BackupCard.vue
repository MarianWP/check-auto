<script setup>
/* Резервна копія оглядів: експорт у файл (у Telegram — у буфер обміну) та відновлення зі злиттям. */
import AppIcon from "./AppIcon.vue";
import SecTitle from "./SecTitle.vue";
import { tgState } from "../tg";
import { exportBackup, importBackupFile, importBackupFromClipboard } from "../backup";

function onFile(ev) {
  const input = ev.target;
  importBackupFile(input.files && input.files[0]);
  input.value = "";
}
</script>

<template>
  <section aria-labelledby="h-backup">
    <SecTitle id="h-backup" icon="download">Резервна копія</SecTitle>
    <div class="group">
      <button class="row" data-action="backup-export" @click="exportBackup()">
        <AppIcon name="download" />
        <div class="row-main">
          <div class="row-t">Зберегти копію</div>
          <div class="row-s">{{ tgState.active ? 'Текст копії потрапить у буфер обміну' : 'Файл JSON з усіма оглядами' }}</div>
        </div>
      </button>
      <!-- label + input: вибір файлу відкривається нативно, без програмного click() поза жестом. -->
      <label class="row" data-action="backup-import">
        <AppIcon name="upload" />
        <div class="row-main">
          <div class="row-t">Відновити з файлу</div>
          <div class="row-s">Додає огляди з копії, наявні не видаляє</div>
        </div>
        <input class="visually-hidden" type="file" accept=".json,application/json,text/plain" aria-label="Файл резервної копії" @change="onFile">
      </label>
      <button v-if="tgState.active" class="row" data-action="backup-paste" @click="importBackupFromClipboard()">
        <AppIcon name="clipboard" />
        <div class="row-main">
          <div class="row-t">Вставити копію з буфера</div>
          <div class="row-s">Скопіюй текст копії зі «Збереженого» і натисни сюди</div>
        </div>
      </button>
    </div>
  </section>
</template>
