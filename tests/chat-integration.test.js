import { beforeEach, afterEach, it, expect, vi } from "vitest";
const env = vi.hoisted(() => ({ user: null, client: null }));
vi.mock("../src/cloud/auth", () => ({ get user() { return env.user; } }));
vi.mock("../src/cloud/client", () => ({ CLOUD: true, CLOUD_URL: "https://test.invalid", CLOUD_KEY: "test", get supabase() { return env.client; }, errText: e => e.message }));
let api, rows, orders, values;
const msg = (n, role = "user") => ({ id: "00000000-0000-0000-0000-" + String(n).padStart(12, "0"), role, content: "message " + n, created_at: new Date(n * 1000).toISOString() });
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); values = new Map(); rows = []; orders = [];
  vi.stubGlobal("localStorage", { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) });
  const { ref } = await import("vue"); env.user = ref({ id: "alice" });
  env.client = {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "test" } } })) },
    from() {
      let direction = true, max = 60;
      const q = { select: () => q, eq: () => q, is: () => q, or: () => q, order: (field, opts) => { orders.push([field, opts]); if (field === "created_at") direction = opts.ascending; return q; }, limit: n => { max = n; return q; },
        abortSignal: async () => ({ data: [...rows].sort((a, b) => direction ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)).slice(0, max) }) };
      return q;
    }
  };
  api = await import("../src/cloud/assistant");
});
afterEach(() => { api.cancelAsk(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("loads the latest 60 messages in chronological display order", async () => {
  rows = Array.from({ length: 75 }, (_, i) => msg(i + 1));
  await api.loadHistory(null);
  expect(api.chat.messages[0].content).toBe("message 16");
  expect(api.chat.messages[59].content).toBe("message 75");
  expect(api.chat.hasMore).toBe(true);
  expect(orders).toContainEqual(["id", { ascending: false }]);
});
it("never displays a previous account's cached conversation", async () => {
  rows = [msg(1)]; await api.loadHistory(null);
  expect(api.chat.messages).toHaveLength(1);
  env.user.value = { id: "bob" };
  expect(api.chat.messages).toHaveLength(0);
  rows = []; await api.loadHistory(null);
  expect(api.chat.messages).toHaveLength(0);
  expect(values.has("golfcheck.chat.v1:alice")).toBe(true);
});
it("keeps the failed question available for retry", async () => {
  await api.loadHistory(null);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })));
  expect(await api.ask("my question")).toBe(false);
  expect(api.chat.retryText).toBe("my question");
  expect(api.chat.messages[0].content).toBe("my question");
  expect(api.chat.messages[0].failed).toBe(true);
  expect(api.chat.streaming).toBe(false);
});
it("reserves the send state before awaiting the session", async () => {
  await api.loadHistory(null);
  let release;
  env.client.auth.getSession.mockImplementationOnce(() => new Promise(r => { release = r; }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("answer")));
  const first = api.ask("first");
  expect(await api.ask("second")).toBe(false);
  release({ data: { session: { access_token: "test" } } });
  expect(await first).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("ignores a late answer after switching conversations", async () => {
  await api.loadHistory("one");
  let resolve;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolve = r; })));
  const request = api.ask("old question", { inspId: "one" });
  await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
  rows = [msg(2)]; await api.loadHistory("two");
  resolve(new Response("late answer")); await request;
  expect(api.chat.loadedFor).toBe("two");
  expect(api.chat.messages.map(m => m.content)).toEqual(["message 2"]);
  const cache = JSON.parse(values.get("golfcheck.chat.v1:alice"));
  expect(cache.one || []).not.toContainEqual(expect.objectContaining({ content: "message 2" }));
});
it("times out a stalled response and unblocks the composer", async () => {
  await api.loadHistory(null);
  vi.stubGlobal("fetch", vi.fn((_url, opts) => new Promise((_r, reject) => {
    opts.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })));
  const request = api.ask("question");
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  await vi.advanceTimersByTimeAsync(60000); await request;
  expect(api.chat.streaming).toBe(false); expect(api.chat.retryText).toBe("question");
});
