import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { CFG, mkInsp } from "./helpers";
let store, values;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); values = new Map();
  vi.stubGlobal("localStorage", { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) });
  store = await import("../src/store");
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("keeps a live screen reference when a cloud inspection replaces its values", () => {
  store.replaceInspections([mkInsp()]); const screen = store.insp("t1");
  store.replaceInspections([{ ...mkInsp(), updatedAt: 2000, name: "remote" }], true);
  expect(screen).toBe(store.insp("t1"));
  store.answer(screen, "item", "ok"); store.flush();
  expect(store.db.inspections[0].answers.item.s).toBe("ok");
});
it("preserves guest draft, isolates accounts, and imports only on request", () => {
  store.replaceInspections([mkInsp()]);
  store.resetDraft({ model: "golf5", fuel: "petrol", ...CFG, name: "draft" });
  store.switchAccount("alice");
  expect(store.db.inspections).toHaveLength(0); expect(store.draft.name).toBe("");
  store.importGuest(); expect(store.db.inspections).toHaveLength(1);
  expect(store.db.inspections[0].id).not.toBe("t1");
  store.switchAccount("bob"); expect(store.db.inspections).toHaveLength(0);
  store.switchAccount(null);
  expect(store.db.inspections[0].id).toBe("t1"); expect(store.draft.name).toBe("draft");
});
it("uses monotonic versions for multiple edits in the same millisecond", () => {
  store.replaceInspections([mkInsp()]); const i = store.insp("t1");
  store.answer(i, "a", "ok"); const first = i.updatedAt;
  store.answer(i, "b", "bad"); expect(i.updatedAt).toBeGreaterThan(first);
});
it("restores a persisted draft and freezes the checklist when creating an inspection", async () => {
  store.resetDraft({ model: "golf5", fuel: "petrol", ...CFG, name: "saved draft" }); store.flush();
  vi.resetModules(); store = await import("../src/store");
  expect(store.draft.name).toBe("saved draft");
  const i = store.createInspection(), before = store.computeReport(i);
  expect(i.checklistSnapshot).toHaveLength(10);
  store.extraItems.list.push({ id: "late", stage: "docs", t: "Late critical check", sev: "crit", enabled: true });
  expect(store.computeReport(i).total).toBe(before.total);
  expect(store.draft.name).toBe("");
});
it("keeps unsaved account data in memory when storage rejects writes", () => {
  store.replaceInspections([mkInsp()]);
  localStorage.setItem = () => { throw new Error("quota"); };
  expect(store.flush()).toBe(false);
  store.switchAccount("alice"); expect(store.db.inspections).toHaveLength(0);
  store.switchAccount(null); expect(store.db.inspections[0].id).toBe("t1");
  expect(store.storage.ok).toBe(false);
});
