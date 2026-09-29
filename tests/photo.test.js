import { describe, it, expect } from "vitest";
import { messageFromRow, readChatCache, putChatCache, focusContext, focusQuestion, PHOTO_THUMB_MAX } from "../src/logic/assistant";
import { parseImage, userContent, MAX_IMAGE_CHARS } from "../supabase/functions/_shared/llm.ts";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("фото в чаті: клієнт", () => {
  it("рядок бази з фото позначає повідомлення, без фото — ні", () => {
    expect(messageFromRow({ id: "1", role: "user", content: "Що тут?", has_photo: true, created_at: "2026-09-29T10:00:00Z" }).photo).toBe(true);
    expect(messageFromRow({ id: "2", role: "user", content: "Текст" })).not.toHaveProperty("photo");
  });
  it("кеш зберігає невелику мініатюру і позначку, а завелике чи чуже — відкидає", () => {
    const big = "data:image/jpeg;base64," + "A".repeat(PHOTO_THUMB_MAX);
    const cache = putChatCache({}, "none", [
      { id: "a", role: "user", content: "з мініатюрою", photo: JPEG },
      { id: "b", role: "user", content: "з хмари", photo: true },
      { id: "c", role: "user", content: "завелика", photo: big },
      { id: "d", role: "user", content: "не картинка", photo: "javascript:alert(1)" }
    ]);
    const back = readChatCache(JSON.stringify(cache)).none;
    expect(back.map(m => m.photo)).toEqual([JPEG, true, undefined, undefined]);
  });
  it("пункт чек-листа потрапляє в контекст і в запитання", () => {
    const it = { t: "Колісні болти цілі, є ключ від секретки", how: "Болти без слідів зривання.", why: "Без ключа колесо не зняти." };
    expect(focusContext(it)).toMatch(/Колісні болти.*Як перевіряти: Болти без слідів.*Чому це важливо: Без ключа/);
    expect(focusQuestion(it)).toBe("Перевір по фото: «Колісні болти цілі, є ключ від секретки»");
    expect(focusContext(null)).toBe("");
  });
});

describe("фото в чаті: функція помічника", () => {
  it("приймає лише data URL JPEG, PNG або WebP розумного розміру", () => {
    expect(parseImage(JPEG)).toEqual({ mediaType: "image/jpeg", data: "/9j/4AAQSkZJRgABAQ==", url: JPEG });
    expect(parseImage("data:image/png;base64,iVBORw0KGgo=")?.mediaType).toBe("image/png");
    expect(parseImage("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(parseImage("https://example.com/a.jpg")).toBeNull();
    expect(parseImage("data:image/jpeg;base64,не base64")).toBeNull();
    expect(parseImage("data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_CHARS))).toBeNull();
    expect(parseImage(42)).toBeNull();
  });
  it("збирає повідомлення з фото у форматі OpenAI і Anthropic", () => {
    const img = parseImage(JPEG);
    expect(userContent("openai", "Що тут?", img)).toEqual([{ type: "text", text: "Що тут?" }, { type: "image_url", image_url: { url: JPEG, detail: "high" } }]);
    expect(userContent("anthropic", "Що тут?", img)).toEqual([{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/4AAQSkZJRgABAQ==" } }, { type: "text", text: "Що тут?" }]);
  });
});
