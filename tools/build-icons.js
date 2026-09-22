/* Збирає src/icons.js з SVG-файлів Lucide (tools/lucide/*.svg).
   Джерело: https://cdn.jsdelivr.net/npm/lucide-static@0.544.0/icons/<name>.svg
   Запуск: node tools/build-icons.js */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAP = {
  chev: "chevron-right", check: "check", x: "x", minus: "minus", plus: "plus",
  alert: "triangle-alert", book: "book-open", share: "share", trash: "trash-2", more: "ellipsis",
  car: "car", clipboard: "clipboard-check", wrench: "wrench", circleCheck: "circle-check", external: "external-link", download: "download", upload: "upload",
  arrowLeft: "arrow-left", arrowRight: "arrow-right", chevDown: "chevron-down", pencil: "pencil", fileText: "file-text",
  circleX: "circle-x", circleAlert: "circle-alert", circleDashed: "circle-dashed", comment: "message-square-text",
  sparkles: "sparkles", send: "send-horizontal", user: "user",
  cog: "cog", settings: "settings", coins: "coins", stethoscope: "stethoscope", backpack: "backpack", hash: "hash", layers: "layers", list: "list",
  gauge: "gauge", palette: "palette", languages: "languages", image: "image", fuel: "fuel", droplet: "droplet"
};

const out = {};
for (const [key, file] of Object.entries(MAP)) {
  const svg = fs.readFileSync(path.join(__dirname, "lucide", file + ".svg"), "utf8");
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error("Не знайдено <svg> у " + file);
  out[key] = m[1].replace(/\s+/g, " ").replace(/\s*\/>/g, "/>").trim();
}
const js = "/* Іконки Lucide (https://lucide.dev), ISC. Згенеровано з lucide-static v0.544.0 скриптом tools/build-icons.js. */\nexport default " + JSON.stringify(out, null, 2) + ";\n";
fs.writeFileSync(path.join(__dirname, "..", "src", "icons.js"), js);
console.log("ok src/icons.js:", Object.keys(out).length, "іконок");
