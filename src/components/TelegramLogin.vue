<script setup>
/* Telegram Login Widget для сайту (поза Telegram). Скрипт віджета зовнішній, тож офлайн кнопка не з'явиться:
   тоді лишається підказка. У BotFather боту потрібен домен сайту (/setdomain). */
import { ref, onMounted, onBeforeUnmount } from "vue";
import { TG_BOT } from "../cloud/client";
import { loginWidget } from "../cloud/auth";

const box = ref(null);
const failed = ref(false);
onMounted(() => {
  if (!TG_BOT || !box.value) return;
  window.onTelegramAuth = user => loginWidget(user);
  const s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-widget.js?22";
  s.async = true;
  s.dataset.telegramLogin = TG_BOT;
  s.dataset.size = "large";
  s.dataset.radius = "16";
  s.dataset.userpic = "false";
  s.dataset.onauth = "onTelegramAuth(user)";
  s.dataset.requestAccess = "write";
  s.onerror = () => { failed.value = true; };
  box.value.appendChild(s);
});
onBeforeUnmount(() => { delete window.onTelegramAuth; });
</script>

<template>
  <div class="tg-login">
    <div ref="box" class="tg-login-box"></div>
    <p v-if="!TG_BOT" class="foot">Вхід через сайт ще не налаштовано: немає імені бота (VITE_TG_BOT). Відкрий застосунок у Telegram.</p>
    <p v-else-if="failed" class="foot">Кнопка Telegram не завантажилася. Перевір інтернет або відкрий застосунок у Telegram.</p>
  </div>
</template>
