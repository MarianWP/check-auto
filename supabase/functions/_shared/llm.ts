// Спільна логіка стрімінгу для Edge Function assistant: розбір SSE обох провайдерів і очікування першого слова.
// Лише Web API (ReadableStream, TextDecoder), без Deno: цей файл також перевіряють тести застосунку (tests/llm.test.js).

export type Ev = { text?: string; finish?: string; error?: string };

// Моделі OpenAI з прихованими роздумами (gpt-5*, o1/o3/o4…). Роздуми витрачають той самий ліміт max_completion_tokens,
// що й видимий текст, тож без reasoning_effort і запасу токенів відповідь може закінчитися порожньою.
// gpt-5-chat-latest роздумів не має і параметр reasoning_effort відхиляє.
export const isReasoningModel = (model: string) => /^(gpt-5(?!-chat)|o\d)/.test(model);

// Тіло запиту до OpenAI Chat Completions.
export function openaiBody(model: string, system: string, messages: unknown[], opts: { budget: number; effort: string }) {
  const body: Record<string, unknown> = { model, stream: true, max_completion_tokens: opts.budget, messages: [{ role: "system", content: system }, ...messages] };
  if (isReasoningModel(model)) body.reasoning_effort = opts.effort;
  return body;
}

// Один рядок SSE → подія. OpenAI: choices[0].delta.content (або refusal) і finish_reason; Anthropic: text_delta і stop_reason.
export function parseLine(line: string): Ev | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  let ev;
  try { ev = JSON.parse(payload); } catch { return null; }
  const choice = ev?.choices?.[0];
  if (choice) {
    const out: Ev = {};
    const t = choice.delta?.content ?? choice.delta?.refusal;
    if (typeof t === "string" && t) out.text = t;
    if (choice.finish_reason) out.finish = String(choice.finish_reason);
    return out.text || out.finish ? out : null;
  }
  if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) return { text: String(ev.delta.text) };
  if (ev?.type === "message_delta" && ev.delta?.stop_reason) return { finish: String(ev.delta.stop_reason) };
  if (ev?.type === "error" || ev?.error) return { error: String(ev.error?.message ?? "невідома помилка") };
  return null;
}

// Потік подій із тіла відповіді провайдера. Якщо споживач зупинився раніше, запит до провайдера скасовується.
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Ev> {
  const reader = body.getReader(), dec = new TextDecoder();
  let buf = "", finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buf += done ? dec.decode() : dec.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = done ? "" : lines.pop() ?? "";
      for (const line of lines) { const ev = parseLine(line); if (ev) yield ev; }
      if (done) { finished = true; return; }
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Чекає першого шматка тексту. Порожній потік повертає причину завершення: "length"/"max_tokens" означає,
// що ліміт токенів пішов на роздуми, а до тексту справа не дійшла.
export async function firstText(events: AsyncGenerator<Ev>): Promise<{ first: string } | { empty: string }> {
  let finish = "";
  for (;;) {
    const { value, done } = await events.next();
    if (done) return { empty: finish || "stop" };
    if (value.text) return { first: value.text };
    if (value.error) { await events.return(undefined); return { empty: "error: " + value.error }; }
    if (value.finish) finish = value.finish;
  }
}

export const cutByLimit = (reason: string) => reason === "length" || reason === "max_tokens";

// Потік відповіді клієнту: перший шматок тексту, далі решта подій. Коли модель закінчила, викликається save(повний текст);
// помилка save обриває потік, щоб клієнт знав, що розмову не збережено.
// Кожен виклик pull мусить або віддати шматок, або закрити потік: якщо pull повернеться ні з чим, браузерний потік
// більше його не викличе і відповідь «зависне» (так було з фінальною подією finish_reason без тексту).
export function replyStream(first: string, events: AsyncGenerator<Ev>, save: (full: string) => Promise<void>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let full = first, sent = false;
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (!sent) { sent = true; ctrl.enqueue(enc.encode(first)); return; }
      for (;;) {
        let step: IteratorResult<Ev>;
        try { step = await events.next(); }
        catch (e) { console.error("stream", String(e)); ctrl.error(new Error("Відповідь перервалася")); return; }
        if (step.done) {
          try { await save(full.trim()); } catch (e) { ctrl.error(e instanceof Error ? e : new Error(String(e))); return; }
          ctrl.close();
          return;
        }
        const ev = step.value;
        let t = ev.text ?? "";
        if (ev.error) t += "\n\n[Помилка сервісу: " + ev.error + "]";
        else if (ev.finish && cutByLimit(ev.finish)) t += "…";
        if (t) { full += t; ctrl.enqueue(enc.encode(t)); return; }
      }
    },
    async cancel() { await events.return(undefined); }
  });
}

// Зрозумілий текст для користувача, коли модель так і не написала жодного слова.
export function emptyReplyError(reason: string): string {
  if (cutByLimit(reason)) return "Модель витратила весь ліміт на роздуми й не дала відповіді. Спробуй ще раз або постав коротше запитання.";
  if (reason === "content_filter") return "Модель відмовилася відповідати на це запитання. Переформулюй його.";
  if (reason.startsWith("error: ")) return "Сервіс ШІ перервав відповідь (" + reason.slice(7, 120) + "). Спробуй ще раз.";
  return "Модель не дала відповіді. Спробуй ще раз.";
}
