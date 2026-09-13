/* Збирає js/icons.js з SVG-файлів Lucide (tools/lucide/*.svg).
   Джерело: https://cdn.jsdelivr.net/npm/lucide-static@0.544.0/icons/<name>.svg
   Запуск: node tools/build-icons.js */
const fs = require("fs");
const path = require("path");

const MAP = {
  back: "chevron-left", chev: "chevron-right", check: "check", x: "x", minus: "minus", plus: "plus",
  info: "info", alert: "triangle-alert", book: "book-open", share: "share", trash: "trash-2", more: "ellipsis",
  car: "car", clipboard: "clipboard-check", wrench: "wrench", circleCheck: "circle-check", external: "external-link", circlePlus: "circle-plus"
};

const out = {};
for (const [key, file] of Object.entries(MAP)) {
  const svg = fs.readFileSync(path.join(__dirname, "lucide", file + ".svg"), "utf8");
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error("Не знайдено <svg> у " + file);
  out[key] = m[1].replace(/\s+/g, " ").replace(/\s*\/>/g, "/>").trim();
}
const js = "/* Іконки Lucide (https://lucide.dev), ISC. Згенеровано з lucide-static v0.544.0 скриптом tools/build-icons.js. */\nwindow.LUCIDE = " + JSON.stringify(out, null, 2) + ";\n";
fs.writeFileSync(path.join(__dirname, "..", "js", "icons.js"), js);
console.log("ok js/icons.js:", Object.keys(out).length, "іконок");
