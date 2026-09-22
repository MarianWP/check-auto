import { describe, it, expect } from "vitest";
import { parsePrefs, resolveTheme, THEMES, LANGS, DEFAULT_PREFS, THEME_BG } from "../src/logic/prefs";

describe("налаштування користувача", () => {
  it("порожнє сховище або сміття → типові значення", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{oops")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("[1,2]")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"theme":"neon","lang":"fr"}')).toEqual(DEFAULT_PREFS);
  });
  it("коректні значення зберігаються", () => {
    expect(parsePrefs('{"theme":"light","lang":"en"}')).toEqual({ theme: "light", lang: "en" });
    THEMES.forEach(t => expect(parsePrefs(JSON.stringify({ theme: t.id })).theme).toBe(t.id));
    LANGS.forEach(l => expect(parsePrefs(JSON.stringify({ lang: l.id })).lang).toBe(l.id));
  });
  it("тема «як у системі» слідує за системою, решта — ні", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
  it("для кожної фактичної теми є колір фону", () => {
    expect(THEME_BG.dark).toMatch(/^#/);
    expect(THEME_BG.light).toMatch(/^#/);
  });
});
