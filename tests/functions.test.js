import { it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { parseAst } from "vite";

/* Edge Functions деплояться окремо і в збірку застосунку не потрапляють, тож синтаксичну помилку
   (як-от загублену дужку) інакше видно лише після деплою, коли функція вже не стартує. */
const dir = new URL("../supabase/functions/", import.meta.url);
const files = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory())
  .flatMap(d => readdirSync(new URL(d.name + "/", dir)).filter(f => f.endsWith(".ts")).map(f => d.name + "/" + f));

it.each(files)("%s розбирається як TypeScript", f => {
  expect(() => parseAst(readFileSync(new URL(f, dir), "utf8"), { lang: "ts" })).not.toThrow();
});
it("спільні модулі імпортуються з розширенням .ts (так вимагає Deno)", () => {
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/from "(\.{1,2}\/[^"]+)"/g)) {
      expect(m[1]).toMatch(/\.ts$/);
      expect(existsSync(new URL(m[1], new URL(f, dir)))).toBe(true);
    }
  }
});
