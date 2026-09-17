import { describe, it, expect } from "vitest";
import { isExternalUrl } from "../src/logic/links";

const APP = "https://marianwp.github.io/check-auto/#/";

describe("зовнішні та внутрішні посилання", () => {
  it("пункти нижньої навігації — внутрішні, у браузер не йдуть", () => {
    ["#/", "#/guide", "#/new", "https://marianwp.github.io/check-auto/#/guide", "https://marianwp.github.io/check-auto/#/report/abc"].forEach(h => {
      expect(isExternalUrl(h, APP), h).toBe(false);
    });
  });

  it("той самий origin з іншим шляхом теж внутрішній", () => {
    expect(isExternalUrl("/check-auto/icons/icon-192.png", APP)).toBe(false);
    expect(isExternalUrl("https://marianwp.github.io/other/", APP)).toBe(false);
  });

  it("інший сайт — зовнішнє посилання", () => {
    expect(isExternalUrl("https://auto.ria.com/uk/search/?brand=84", APP)).toBe(true);
    expect(isExternalUrl("http://example.com/", APP)).toBe(true);
    expect(isExternalUrl("https://github.io/check-auto/", APP)).toBe(true);
  });

  it("не http(s) і зіпсовані адреси не чіпаємо", () => {
    expect(isExternalUrl("mailto:a@b.c", APP)).toBe(false);
    expect(isExternalUrl("tel:+380000000000", APP)).toBe(false);
    expect(isExternalUrl("javascript:void(0)", APP)).toBe(false);
    expect(isExternalUrl("https://", APP)).toBe(false);
    expect(isExternalUrl("#/guide", "не адреса")).toBe(false);
  });

  it("працює і з локальної адреси розробки", () => {
    expect(isExternalUrl("#/guide", "http://localhost:5173/check-auto/")).toBe(false);
    expect(isExternalUrl("https://auto.ria.com/", "http://localhost:5173/check-auto/")).toBe(true);
  });
});
