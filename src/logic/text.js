/* Дрібна логіка тексту інтерфейсу. Без Vue — покрито тестами у tests/text.test.js. */

/* Українська множина: 1 пункт, 2 пункти, 5 пунктів (11–14 — завжди «пунктів»). */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 15) return many;
  if (b === 1) return one;
  if (b > 1 && b < 5) return few;
  return many;
}
export const count = (n, one, few, many) => n + " " + plural(n, one, few, many);
