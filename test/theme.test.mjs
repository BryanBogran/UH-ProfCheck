import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../src/theme.js", import.meta.url), "utf8");

function startTheme({ stored, browserApi = false, deferRead = false } = {}) {
  const classes = new Set();
  let listener;
  let finishRead;
  const api = {
    storage: {
      sync: { get: () => deferRead
        ? new Promise((resolve) => { finishRead = resolve; })
        : Promise.resolve({ darkMode: stored }) },
      onChanged: { addListener: (callback) => { listener = callback; } }
    }
  };
  const context = vm.createContext({
    [browserApi ? "browser" : "chrome"]: api,
    document: { documentElement: { classList: { toggle: (name, enabled) => {
      if (enabled) classes.add(name);
      else classes.delete(name);
    } } } }
  });
  const ready = vm.runInContext(source, context);
  return {
    ready,
    isDark: () => classes.has("profcheck-dark"),
    change: (changes, area = "sync") => listener(changes, area),
    finishRead: (value) => finishRead(value)
  };
}

test("new installs keep the enrollment page in its original theme", async () => {
  const theme = startTheme();
  await theme.ready;
  assert.equal(theme.isDark(), false);
});

test("a saved preference restores dark mode in Chrome and Firefox documents", async () => {
  for (const browserApi of [false, true]) {
    const theme = startTheme({ stored: true, browserApi });
    await theme.ready;
    assert.equal(theme.isDark(), true);
  }
});

test("sync changes apply immediately and removing the preference restores light mode", async () => {
  const theme = startTheme();
  await theme.ready;
  theme.change({ darkMode: { newValue: true } });
  assert.equal(theme.isDark(), true);
  theme.change({ darkMode: { oldValue: true } });
  assert.equal(theme.isDark(), false);
});

test("unrelated settings and local storage never change the theme", async () => {
  const theme = startTheme({ stored: true });
  await theme.ready;
  theme.change({ defaultScoringMode: { newValue: "lowestRisk" } });
  theme.change({ darkMode: { newValue: false } }, "local");
  assert.equal(theme.isDark(), true);
});

test("a fresh storage event wins over an older startup read", async () => {
  const theme = startTheme({ deferRead: true });
  theme.change({ darkMode: { newValue: true } });
  theme.finishRead({ darkMode: false });
  await theme.ready;
  assert.equal(theme.isDark(), true);
});

test("invalid stored values do not opt users into dark mode", async () => {
  for (const stored of [false, "true", 1, null]) {
    const theme = startTheme({ stored });
    await theme.ready;
    assert.equal(theme.isDark(), false);
  }
});
