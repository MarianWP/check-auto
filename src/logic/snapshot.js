/* Знімок чек-листа в огляді заморожує склад пунктів, їхню вагу (sev) і вартість (cost): звіт старого огляду
   не зміниться після оновлення довідника чи адмінки. Тексти вбудованих пунктів (як перевірити, чому важливо,
   теги, нотатки) у знімку не зберігаємо — беремо з поточного чек-листа за id. Повні тексти роздували кожен огляд
   з 2,6 КБ до 64 КБ, і ці кілобайти переписувались у сховищі й летіли в хмару на кожну відповідь.
   Формат лишається масивом етапів з пунктами {id, t, sev, cost}, тож його читають і старі версії застосунку.
   Власні пункти (адмінка, ШІ) зберігаються повністю: у довіднику їх може вже не бути. Без Vue — покрито тестами. */
import CL from "../data/checklist.js";

const STAGES = new Map(CL.map(s => [s.id, s]));
const ITEMS = new Map(CL.flatMap(s => s.items.map(it => [it.id, it])));

/* Чи є пункт / етап у вбудованому чек-листі (тоді його тексти не зберігаємо). */
export const builtinItem = id => ITEMS.has(id);
export const builtinStage = id => STAGES.has(id);

/* Знімок → етапи для інтерфейсу і звіту. Склад, назва, sev і cost — зі знімка; решта — з довідника.
   Результат кешується за об'єктом знімка: знімок ніколи не змінюється на місці, лише замінюється цілком. */
const cache = new WeakMap();
export function hydrateSnapshot(snap) {
  if (!Array.isArray(snap)) return snap;
  let out = cache.get(snap);
  if (out) return out;
  out = snap.map(s => {
    const base = STAGES.get(s.id);
    return Object.assign({}, base ? { intro: base.intro } : {}, s, { items: s.items.map(hydrateItem) });
  });
  cache.set(snap, out);
  return out;
}
function hydrateItem(it) {
  const base = ITEMS.get(it.id);
  if (!base) return it;
  /* Вартість — лише зі знімка: від неї залежать бюджет і вердикт. */
  return Object.assign({}, base, it, {
    how: it.how || base.how, why: it.why || base.why,
    tags: it.tags && it.tags.length ? it.tags : base.tags, notes: it.notes || base.notes, cost: it.cost
  });
}
