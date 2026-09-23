import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { CFG, mkInsp } from "./helpers";
const env = vi.hoisted(() => ({ user: null, client: null }));
vi.mock("../src/cloud/auth", () => ({ get user() { return env.user; } }));
vi.mock("../src/cloud/client", () => ({ CLOUD: true, sb: async () => env.client, errText: e => e.message }));
let store, sync, remote, rpcCalls, reads, served;
const row = (name = "remote", revision = 1) => ({ id: "t1", user_id: "alice", model: "golf5", cfg: CFG, answers: {}, name, price: 0, stage: 0, done: false, revision, created_at: new Date(1000).toISOString(), updated_at: new Date(2000).toISOString(), synced_at: new Date().toISOString() });
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  const values = new Map(); remote = new Map(); rpcCalls = []; reads = []; served = [];
  vi.stubGlobal("localStorage", { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", { addEventListener: vi.fn() }); vi.stubGlobal("document", { addEventListener: vi.fn() });
  const { ref } = await import("vue"); env.user = ref({ id: "alice" });
  env.client = {
    from(table) {
      reads.push(table);
      let since = null;
      const q = { select: () => q, eq: () => q, order: () => q, gt: (col, v) => { since = [col, v]; return q; },
        range: async () => {
          const data = table === "inspections" ? [...remote.values()].filter(r => !since || r[since[0]] > since[1]).map(r => structuredClone(r)) : [];
          if (table === "inspections") served.push(...data.map(r => r.id));
          return { data, error: null };
        } };
      return q;
    },
    rpc: vi.fn(async (_fn, args) => {
      rpcCalls.push(structuredClone(args));
      const old = remote.get(args.p_id);
      if (old && (old.revision !== args.p_base_revision || old.deleted_at)) return { data: { conflict: true, row: old } };
      const next = args.p_record ? { ...args.p_record, revision: (old?.revision || 0) + 1, synced_at: new Date().toISOString() } : { ...(old || { id: args.p_id }), revision: (old?.revision || 0) + 1, deleted_at: new Date().toISOString(), synced_at: new Date().toISOString() };
      remote.set(args.p_id, next); return { data: { conflict: false, row: structuredClone(next) } };
    })
  };
  store = await import("../src/store"); store.switchAccount("alice");
  sync = await import("../src/cloud/sync"); sync.initSync(); await sync.fullSync();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("sends a second snapshot for an edit made during an upload", async () => {
  store.replaceInspections([mkInsp()]);
  let release; const original = env.client.rpc.getMockImplementation();
  env.client.rpc.mockImplementationOnce(async (...args) => { await new Promise(r => { release = r; }); return original(...args); });
  const running = sync.fullSync();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  store.setComment(store.insp("t1"), "item", "edited while pending");
  const duplicate = sync.fullSync(); expect(duplicate).toBe(running);
  release(); await running;
  expect(rpcCalls).toHaveLength(2);
  expect(rpcCalls[0].p_record.answers).toEqual({});
  expect(rpcCalls[1].p_record.answers.item.c).toBe("edited while pending");
  expect(sync.sync.pending).toBe(0);
});
it("retains a deletion queued while another request is pending", async () => {
  store.replaceInspections([mkInsp(), { ...mkInsp(), id: "t2" }]); await sync.fullSync();
  store.remove("t1");
  let release; const original = env.client.rpc.getMockImplementation();
  env.client.rpc.mockImplementationOnce(async (...args) => { await new Promise(r => { release = r; }); return original(...args); });
  const running = sync.fullSync(); await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  store.remove("t2"); release(); await running;
  expect(remote.get("t1").deleted_at).toBeTruthy(); expect(remote.get("t2").deleted_at).toBeTruthy();
  expect(sync.sync.pending).toBe(0);
});
it("applies remote deletions and preserves conflicting local answers as a copy", async () => {
  remote.set("t1", row()); await sync.fullSync();
  store.answer(store.insp("t1"), "item", "bad");
  remote.set("t1", { ...row("deleted", 2), deleted_at: new Date().toISOString() });
  await sync.fullSync();
  expect(store.insp("t1")).toBeUndefined();
  expect(store.db.inspections).toHaveLength(1);
  expect(store.db.inspections[0].answers.item.s).toBe("bad");
  expect(store.db.inspections[0].id).not.toBe("t1");
});
it("does not apply a late response to another account", async () => {
  store.replaceInspections([mkInsp()]);
  let release; const original = env.client.rpc.getMockImplementation();
  env.client.rpc.mockImplementationOnce(async (...args) => { await new Promise(r => { release = r; }); return original(...args); });
  const running = sync.fullSync(); await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  store.switchAccount(null); env.user.value = null;
  release(); await running;
  expect(store.account.scope).toBe("guest"); expect(store.db.inspections).toHaveLength(0);
  expect(sync.sync.pending).toBe(0);
});
it("fails visibly when the server migration is missing", async () => {
  store.replaceInspections([mkInsp()]);
  env.client.rpc.mockResolvedValue({ error: new Error("sync_inspection not found") });
  await sync.fullSync();
  expect(sync.sync.state).toBe("error"); expect(sync.sync.pending).toBe(1);
  expect(store.insp("t1")).toBeTruthy();
});
it("a local edit only uploads and does not re-download the account", async () => {
  store.replaceInspections([mkInsp()]); await sync.fullSync();
  reads.length = 0; rpcCalls.length = 0;
  store.answer(store.insp("t1"), "item", "ok");
  await vi.advanceTimersByTimeAsync(1600);
  await vi.waitFor(() => expect(rpcCalls).toHaveLength(1));
  expect(rpcCalls[0].p_record.answers.item.s).toBe("ok");
  expect(reads).toEqual([]);
  expect(sync.sync.pending).toBe(0);
});
it("later pulls skip rows that have not changed since the previous pull", async () => {
  remote.set("t1", { ...row("old"), synced_at: new Date(Date.now() - 10 * 60000).toISOString() });
  remote.set("t2", { ...row("fresh"), id: "t2" });
  await sync.fullSync();
  expect(served.sort()).toEqual(["t1", "t2"]);
  served.length = 0;
  await sync.fullSync();
  /* t2 лежить у двохвилинному перекритті курсора, t1 — давно не змінювався. */
  expect(served).toEqual(["t2"]);
  expect(store.insp("t1").name).toBe("old");
});
it("returning to the app pulls changes made on another device", async () => {
  const onVisible = document.addEventListener.mock.calls.find(c => c[0] === "visibilitychange")[1];
  remote.set("t1", row("from phone"));
  document.visibilityState = "visible"; onVisible();
  await vi.advanceTimersByTimeAsync(1600);
  await vi.waitFor(() => expect(store.insp("t1")?.name).toBe("from phone"));
});
it("an upload that hits a newer server revision keeps local answers as a copy", async () => {
  remote.set("t1", row()); await sync.fullSync();
  store.answer(store.insp("t1"), "item", "bad");
  remote.set("t1", { ...row("edited elsewhere", 2) });
  await sync.push();
  expect(store.insp("t1").name).toBe("edited elsewhere");
  const copy = store.db.inspections.find(i => i.id !== "t1");
  expect(copy.answers.item.s).toBe("bad");
});
