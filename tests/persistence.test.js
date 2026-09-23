import { describe, it, expect, vi } from "vitest";
import { accountKey, readAccount, writeAccount } from "../src/logic/persistence";
const storage = () => {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: vi.fn((k, v) => data.set(k, v)), removeItem: k => data.delete(k) };
};
const initial = () => ({ inspections: [{ id: "a", updatedAt: 1, name: "first" }, { id: "b", updatedAt: 1, name: "second" }], models: [], draft: { name: "draft" } });
describe("atomic account persistence", () => {
  it("writes only the changed inspection plus the manifest", () => {
    const s = storage(), data = initial();
    writeAccount(s, "u", data); s.setItem.mockClear();
    data.inspections[0].updatedAt = 2; data.inspections[0].name = "edited";
    writeAccount(s, "u", data);
    expect(s.setItem).toHaveBeenCalledTimes(2);
    expect(readAccount(s, "u").inspections[0].name).toBe("edited");
    expect(s.data.size).toBe(3);
  });
  it("keeps the last committed data if the manifest cannot be written", () => {
    const s = storage(), data = initial(); writeAccount(s, "u", data);
    const before = new Map(s.data), set = s.setItem;
    s.setItem = (k, v) => { if (k === accountKey("u")) throw new Error("quota"); set(k, v); };
    data.inspections[0].updatedAt++; data.inspections[0].name = "unsaved";
    expect(() => writeAccount(s, "u", data)).toThrow("quota");
    expect(s.data).toEqual(before);
    expect(readAccount(s, "u").inspections[0].name).toBe("first");
  });
  it("isolates users and guest data", () => {
    const s = storage(); writeAccount(s, "guest", initial());
    writeAccount(s, "u", { ...initial(), inspections: [] });
    expect(readAccount(s, "guest").inspections).toHaveLength(2);
    expect(readAccount(s, "u").inspections).toHaveLength(0);
    expect(readAccount(s, "other")).toBeNull();
  });
  it("persists a remote change even with an equal timestamp", () => {
    const s = storage(), data = initial(); writeAccount(s, "u", data);
    data.inspections[0].name = "remote"; data.inspections[0]._persist = 1;
    writeAccount(s, "u", data);
    expect(readAccount(s, "u").inspections[0].name).toBe("remote");
  });
});
