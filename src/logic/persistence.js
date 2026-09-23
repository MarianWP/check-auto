/* Immutable record writes followed by one atomic manifest commit. Old records are
   removed only after commit; a quota error leaves the previous manifest readable. */
export const accountKey = scope => "golfcheck.account.v2:" + encodeURIComponent(scope || "guest");
export function readAccount(storage, scope) {
  const raw = storage.getItem(accountKey(scope));
  if (!raw) return null;
  const m = JSON.parse(raw);
  if (!Array.isArray(m.records)) throw new Error("Invalid account manifest");
  return { ...m, inspections: m.records.map(r => {
    const value = storage.getItem(r.key);
    if (!value) throw new Error("Missing inspection " + r.id);
    return JSON.parse(value);
  }) };
}
export function writeAccount(storage, scope, data) {
  const key = accountKey(scope);
  let previous = { records: [] };
  try { previous = JSON.parse(storage.getItem(key) || "null") || previous; } catch { /* preserve malformed manifest elsewhere */ }
  const old = new Map((previous.records || []).map(r => [r.id, r]));
  const created = [];
  try {
    const records = data.inspections.map(i => {
      const prev = old.get(i.id);
      const stamp = i.updatedAt + ":" + (i._persist || 0);
      if (prev && prev.stamp === stamp) return prev;
      const record = { id: i.id, stamp, key: key + ":record:" + encodeURIComponent(i.id) + ":" + i.updatedAt + ":" + Math.random().toString(36).slice(2) };
      storage.setItem(record.key, JSON.stringify(i));
      created.push(record.key);
      return record;
    });
    const { inspections: _inspections, ...rest } = data;
    storage.setItem(key, JSON.stringify({ ...rest, records }));
    const keep = new Set(records.map(r => r.key));
    for (const r of old.values()) if (!keep.has(r.key)) { try { storage.removeItem(r.key); } catch { /* cleanup can wait */ } }
  } catch (error) {
    for (const k of created) { try { storage.removeItem(k); } catch { /* best effort */ } }
    throw error;
  }
}
