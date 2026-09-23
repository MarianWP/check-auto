import { describe, it, expect } from "vitest";
import { normalizeSupabaseUrl, normalizeKey, cloudConfig, authStorageKey, storedSession } from "../src/logic/cloud";

describe("адреса Supabase із секрету збірки", () => {
  it("повна адреса лишається, зайві пробіли і слеш прибираються", () => {
    expect(normalizeSupabaseUrl(" https://abcdefghijklmnopqrst.supabase.co/ ")).toBe("https://abcdefghijklmnopqrst.supabase.co");
  });
  it("лише ref або адреса без https:// добудовуються", () => {
    expect(normalizeSupabaseUrl("abcdefghijklmnopqrst")).toBe("https://abcdefghijklmnopqrst.supabase.co");
    expect(normalizeSupabaseUrl("abcdefghijklmnopqrst.supabase.co")).toBe("https://abcdefghijklmnopqrst.supabase.co");
  });
  it("сміття → порожньо, а не виняток", () => {
    expect(normalizeSupabaseUrl("")).toBe("");
    expect(normalizeSupabaseUrl("   ")).toBe("");
    expect(normalizeSupabaseUrl("postgresql://user@host:5432/db")).toBe("");
    expect(normalizeSupabaseUrl("просто текст")).toBe("");
    expect(normalizeSupabaseUrl(null)).toBe("");
  });
  it("ключ очищається від лапок", () => {
    expect(normalizeKey(' "sb_publishable_abc" ')).toBe("sb_publishable_abc");
  });
});

describe("підсумок налаштувань хмари", () => {
  it("без змінних хмара вимкнена без помилки", () => {
    expect(cloudConfig({})).toEqual({ url: "", key: "", enabled: false, error: "" });
  });
  it("крива адреса → вимкнено з поясненням", () => {
    const c = cloudConfig({ VITE_SUPABASE_URL: "nhz", VITE_SUPABASE_ANON_KEY: "k" });
    expect(c.enabled).toBe(false);
    expect(c.error).toMatch(/VITE_SUPABASE_URL/);
  });
  it("без ключа → вимкнено з поясненням", () => {
    expect(cloudConfig({ VITE_SUPABASE_URL: "abcdefghijklmnopqrst" }).error).toMatch(/ANON_KEY/);
  });
  it("робочі значення → увімкнено", () => {
    expect(cloudConfig({ VITE_SUPABASE_URL: "abcdefghijklmnopqrst", VITE_SUPABASE_ANON_KEY: "sb_publishable_x" })).toEqual({ url: "https://abcdefghijklmnopqrst.supabase.co", key: "sb_publishable_x", enabled: true, error: "" });
  });
});

describe("сесія з минулого запуску", () => {
  it("ключ збігається з типовим ключем supabase-js", () => {
    expect(authStorageKey("https://abcdefghijklmnopqrst.supabase.co")).toBe("sb-abcdefghijklmnopqrst-auth-token");
    expect(authStorageKey("не адреса")).toBe("");
  });
  it("повертає сесію лише з токеном і id користувача", () => {
    const s = { access_token: "a", refresh_token: "r", user: { id: "u1" } };
    expect(storedSession(JSON.stringify(s))).toEqual(s);
    expect(storedSession(JSON.stringify({ access_token: "a" }))).toBeNull();
    expect(storedSession(JSON.stringify({ user: { id: "u1" } }))).toBeNull();
    expect(storedSession("{зламано")).toBeNull();
    expect(storedSession(null)).toBeNull();
  });
});
