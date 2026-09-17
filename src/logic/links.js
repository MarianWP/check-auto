/* Чи веде посилання за межі застосунку. Лише такі посилання у Telegram віддаємо в openLink (зовнішній браузер).
   Внутрішні переходи (#/guide, #/new …) мають той самий origin і лишаються роутеру —
   інакше нижня навігація відкривала б сайт у браузері замість екрана в застосунку. */
export function isExternalUrl(href, baseHref) {
  let url, base;
  try { base = new URL(baseHref); url = new URL(href, base); } catch (e) { return false; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.origin !== base.origin;
}
