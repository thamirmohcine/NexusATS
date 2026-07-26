import assert from "node:assert/strict";
import test from "node:test";

import {
  THEME_STORAGE_KEY,
  getInitialTheme,
  persistTheme,
  syncThemeClass,
} from "../src/hooks/useTheme";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class MemoryClassList {
  private classes = new Set<string>();

  add(token: string): void {
    this.classes.add(token);
  }

  remove(token: string): void {
    this.classes.delete(token);
  }

  has(token: string): boolean {
    return this.classes.has(token);
  }
}

test("theme initialization prefers a valid stored theme", () => {
  assert.equal(
    getInitialTheme({ storedTheme: "dark", prefersDark: false }),
    "dark",
  );
  assert.equal(
    getInitialTheme({ storedTheme: "light", prefersDark: true }),
    "light",
  );
});

test("theme initialization falls back to the system preference", () => {
  assert.equal(
    getInitialTheme({ storedTheme: null, prefersDark: true }),
    "dark",
  );
  assert.equal(
    getInitialTheme({ storedTheme: "unexpected", prefersDark: false }),
    "light",
  );
});

test("theme persistence uses the app theme storage key", () => {
  const storage = new MemoryStorage();

  persistTheme(storage, "dark");

  assert.equal(storage.getItem(THEME_STORAGE_KEY), "dark");
});

test("theme class synchronization toggles the dark class", () => {
  const classList = new MemoryClassList();

  syncThemeClass("dark", classList);
  assert.equal(classList.has("dark"), true);

  syncThemeClass("light", classList);
  assert.equal(classList.has("dark"), false);
});

test("legacy Vite module path re-exports theme utilities", async () => {
  const themeModule = await import("../src/hooks/useTheme.tsx");

  assert.equal(themeModule.THEME_STORAGE_KEY, THEME_STORAGE_KEY);
  assert.equal(typeof themeModule.useTheme, "function");
});
