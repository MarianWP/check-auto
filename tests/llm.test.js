import { describe, it, expect } from "vitest";
import { parseLine, sseEvents, firstText, openaiBody, isReasoningModel, emptyReplyError } from "../supabase/functions/_shared/llm.ts";

/* Тіло відповіді провайдера з довільною нарізкою на шматки (як приходить мережею). */
function body(text, cut = 7) {
  const bytes = new TextEncoder().encode(text);
  let k = 0;
  return new ReadableStream({ pull(c) { if (k >= bytes.length) { c.close(); return; } c.enqueue(bytes.slice(k, k + cut)); k += cut; } });
}
const sse = events => events.map(e => "data: " + (typeof e === "string" ? e : JSON.stringify(e)) + "\n\n").join("");
const delta = content => ({ choices: [{ delta: { content } }] });
async function collect(gen) { const out = []; for await (const e of gen) out.push(e); return out; }

describe("запит до OpenAI", () => {
  it("моделям з роздумами задає reasoning_effort, звичайним — ні", () => {
    expect(isReasoningModel("gpt-5")).toBe(true);
    expect(isReasoningModel("gpt-5-mini")).toBe(true);
    expect(isReasoningModel("o4-mini")).toBe(true);
    expect(isReasoningModel("gpt-5-chat-latest")).toBe(false);
    expect(isReasoningModel("gpt-4.1")).toBe(false);
    expect(openaiBody("gpt-5", "sys", [], { budget: 6000, effort: "low" })).toMatchObject({ reasoning_effort: "low", max_completion_tokens: 6000, stream: true });
    expect(openaiBody("gpt-4.1", "sys", [], { budget: 1600, effort: "low" })).not.toHaveProperty("reasoning_effort");
  });
});

describe("розбір SSE", () => {
  it("збирає текст OpenAI, навіть коли рядки розірвані між шматками", async () => {
    const text = sse([{ choices: [{ delta: { role: "assistant", content: "" } }] }, delta("Перевір "), delta("ремінь ГРМ."), { choices: [{ delta: {}, finish_reason: "stop" }] }, "[DONE]"]);
    const events = await collect(sseEvents(body(text, 5)));
    expect(events.map(e => e.text || "").join("")).toBe("Перевір ремінь ГРМ.");
    expect(events.at(-1)).toEqual({ finish: "stop" });
  });
  it("розуміє Anthropic і рядки з \\r\\n", async () => {
    const text = [{ type: "content_block_delta", delta: { type: "text_delta", text: "Так" } }, { type: "message_delta", delta: { stop_reason: "end_turn" } }]
      .map(e => "event: x\r\ndata: " + JSON.stringify(e) + "\r\n\r\n").join("");
    expect(await collect(sseEvents(body(text)))).toEqual([{ text: "Так" }, { finish: "end_turn" }]);
  });
  it("показує відмову моделі як текст, а не порожнечу", () => {
    expect(parseLine("data: " + JSON.stringify({ choices: [{ delta: { refusal: "Не можу допомогти" } }] }))).toEqual({ text: "Не можу допомогти" });
  });
  it("ігнорує службові рядки", () => {
    expect(parseLine(": keep-alive")).toBeNull();
    expect(parseLine("data: [DONE]")).toBeNull();
    expect(parseLine("data: {не json")).toBeNull();
  });
});

describe("перше слово", () => {
  it("повертає перший текст і лишає решту потоку", async () => {
    const gen = sseEvents(body(sse([delta(""), delta("Раз"), delta(" два")])));
    expect(await firstText(gen)).toEqual({ first: "Раз" });
    expect((await collect(gen)).map(e => e.text).join("")).toBe(" два");
  });
  it("порожня відповідь через ліміт на роздуми дає причину length і зрозумілий текст", async () => {
    const gen = sseEvents(body(sse([{ choices: [{ delta: { role: "assistant", content: "" } }] }, { choices: [{ delta: {}, finish_reason: "length" }] }, "[DONE]"])));
    const r = await firstText(gen);
    expect(r).toEqual({ empty: "length" });
    expect(emptyReplyError(r.empty)).toMatch(/ліміт на роздуми/);
  });
  it("помилка сервісу до першого слова — причина error", async () => {
    const r = await firstText(sseEvents(body(sse([{ error: { message: "overloaded" } }]))));
    expect(r).toEqual({ empty: "error: overloaded" });
    expect(emptyReplyError(r.empty)).toMatch(/overloaded/);
  });
  it("зупинка споживача скасовує запит до провайдера", async () => {
    let cancelled = false;
    const src = new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(sse([delta("a")]))); },
      cancel() { cancelled = true; }
    });
    const gen = sseEvents(src);
    await firstText(gen);
    await gen.return(undefined);
    expect(cancelled).toBe(true);
  });
});
