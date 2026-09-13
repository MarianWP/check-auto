# Golf Check

Чек-лист огляду Volkswagen Golf V перед покупкою. PWA: відкривається в Safari, додається на Початковий екран iPhone, працює офлайн. Працює і як Telegram Mini App. Без діагностики й товщиноміра — тільки очі, руки, вуха.

Стек: Vue 3, vue-router 4, Vite, vite-plugin-pwa. Збірка через `npm run build`, деплой на GitHub Pages через GitHub Actions.

## Що всередині

- **Довідник Golf V**: 17 моторів (бензин і дизель) з кодами, роками, ГРМ, надійністю, ГБО, типовими хворобами і цінами; 5 коробок; 5 кузовів; комплектації; VIN і заводи; спільні хвороби покоління.
- **Конфігуратор**: паливо → мотор → кузов → рік → коробка. Далі картка моделі з ринковою ціною в Україні.
- **Чек-лист**: 10 етапів, понад 100 пунктів. Пункти залежать від мотора (ланцюг чи ремінь, турбіна, DSG, ГБО тощо). Кожен пункт: як перевірити, чому важливо, вага (критично / важливо / дрібниця), швидкі теги і коментар.
- **Звіт**: оцінка, вердикт, бюджет на усунення проблем, порівняння з ринком, список проблем з коментарями. Можна поділитись текстом.

Дані зберігаються тільки в браузері телефону (localStorage).

## Розробка

```
npm install      # один раз
npm run dev      # http://localhost:5173/check-auto/
npm run build    # збірка у dist/
npm run preview  # перегляд збірки: http://localhost:4173/check-auto/
npm run icons    # перегенерувати PNG-іконки і src/icons.js
```

## Файли

```
index.html              оболонка (Vite entry), підключення Telegram SDK лише з Telegram
vite.config.js          база /check-auto/, PWA (маніфест, service worker)
.github/workflows/      збірка і деплой на GitHub Pages
public/icons/           PNG-іконки
src/main.js             точка входу: застосунок, роутер, service worker, хуки Telegram
src/App.vue             корінь: router-view, таб-бар, аркуш дій, тост
src/router.js           маршрути (hash-режим)
src/nav.js              навігація: напрямок анімації, «Назад», вкладки
src/actions.js          меню перевірки, перейменування, видалення, поділитися
src/store.js            стан (reactive), збереження у localStorage, обчислення звіту
src/tg.js               інтеграція з Telegram Mini App (тема, повний екран, кнопка «Назад»)
src/icons.js            іконки Lucide (генерується)
src/data/golf.js        довідник: мотори, коробки, кузови, ціни, хвороби
src/data/checklist.js   етапи і пункти чек-листа
src/assets/app.css      стилі
src/components/         AppScreen (єдиний скролер), NavBar, TabBar, ChipGroup, SheetHost, ToastHost,
                        InspRow, InstallCard, IssueRow, PriceBlock, EngineBlock, GearBlock,
                        CommonBlock, KitBlock, VinBlock, ScoreRing, EngineRow, AppIcon, DotsRating
src/views/              HomeView, NewCheckView, CarView, GuideView, EngineView, CheckView, ReportView
tools/                  скрипти генерації іконок
```

Маршрути: `#/` перевірки, `#/new` нова перевірка, `#/guide` і `#/guide/:мотор` довідник, `#/car/:id` картка моделі, `#/check/:id/:етап` чек-лист, `#/report/:id` звіт.

## Публікація (GitHub Pages)

Репозиторій: `github.com/MarianWP/check-auto`, гілка `main`.

1. **Settings → Pages → Build and deployment → Source**: *GitHub Actions* (не «Deploy from a branch»).
2. Кожен `git push` у `main` запускає workflow `Deploy to GitHub Pages`: `npm ci` → `npm run build` → публікація `dist/`.
3. Сайт: `https://marianwp.github.io/check-auto/`. Хід деплою видно у вкладці **Actions**.

## Telegram Mini App

1. У [@BotFather](https://t.me/BotFather): `/newbot` (якщо бота ще немає), потім `/newapp` → обери бота → назва, опис, картинка 640×360 → **Web App URL**: `https://marianwp.github.io/check-auto/` → коротка назва, наприклад `golf`. Готове посилання: `https://t.me/<бот>/golf`.
2. Або `/mybots` → бот → **Bot Settings → Menu Button** → той самий URL. Тоді апка відкривається кнопкою меню в чаті з ботом.
3. Усередині Telegram апка сама розгортається на весь екран, підхоплює світлу/темну тему, показує системну кнопку «Назад», а «Поділитися звітом» надсилає текст у чат.

## Як встановити на iPhone

1. Відкрий посилання в **Safari** (не в Chrome і не в месенджері).
2. Натисни кнопку **Поділитися** (квадрат зі стрілкою вгору).
3. Обери **На Початковий екран** → **Додати**.
4. Іконка «Golf Check» з'явиться на робочому столі. Запускається як звичайна апка, без адресного рядка, працює без інтернету.

## Як оновити дані

- Ціни та хвороби моторів: `src/data/golf.js`. Середня ринкова ціна у `MARKET.avg`, діапазони по моторах у полі `price` кожного двигуна.
- Пункти чек-листа: `src/data/checklist.js`. Поле `only` обмежує пункт тегами мотора чи коробки (`belt`, `chain`, `turbo`, `dsg`, `manual`, `petrol`, `diesel`, `pd`, `dpf`, `vr6`, `twincharger`).
- Service worker оновлюється сам при кожній збірці (хеші файлів), окремо піднімати версію не треба.
- Іконки: `npm run icons` (Lucide-джерела у `tools/lucide/`).

Ціни орієнтовні, за даними auto.ria станом на вересень 2026.
