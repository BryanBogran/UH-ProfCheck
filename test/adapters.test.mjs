// node --test test/adapters.test.mjs
// 1. Lints every adapter for APIs it may not use (no browser needed).
// 2. Runs each adapter on its synthetic fixtures in headless Chrome and compares
//    the result with <fixture>.expected.json.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { launchChrome } from "./helpers/chrome.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADAPTER_DIR = join(ROOT, "src", "adapters");
const FIXTURE_DIR = join(ROOT, "test", "fixtures", "campuses");
const NOT_ADAPTERS = new Set(["registry.js", "_template.js"]);

const BANNED = [
  "fetch", "XMLHttpRequest", "WebSocket", "chrome.", "browser.", "eval", "Function(",
  "import(", "importScripts", "setTimeout", "setInterval", "localStorage", "sessionStorage",
  "indexedDB", "document.cookie", "postMessage", "sendBeacon"
];

// Campuses not in src/campuses.js (the example) get metadata here.
const TEST_ONLY_CAMPUSES = {
  example: {
    id: "example", displayName: "Example State University", host: "classes.example.edu",
    features: { seats: true, instructors: true, grades: false, ratings: false, rankings: false },
    dataSources: []
  }
};

const adapterFiles = readdirSync(ADAPTER_DIR).filter((name) => name.endsWith(".js"));

/** Comments may explain the rules, so only code is checked. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("adapters use none of the banned APIs", () => {
  for (const file of adapterFiles.filter((name) => name !== "registry.js")) {
    const code = stripComments(readFileSync(join(ADAPTER_DIR, file), "utf8"));
    for (const word of BANNED) {
      // Word boundaries on the alphabetic ends so "prefetch" or "Functional" don't match.
      const pattern = new RegExp(`${/^\w/.test(word) ? "\\b" : ""}${escapeRegExp(word)}${/\w$/.test(word) ? "\\b" : ""}`);
      assert.ok(!pattern.test(code), `${file} uses "${word}", which adapters may not use (see src/adapters/contract.md)`);
    }
  }
});

test("adapters wrap their code so helpers cannot collide", () => {
  for (const file of adapterFiles.filter((name) => !NOT_ADAPTERS.has(name))) {
    const code = stripComments(readFileSync(join(ADAPTER_DIR, file), "utf8")).trim();
    assert.match(code, /^\(\(\) => \{[\s\S]*\}\)\(\);$/, `${file} must be wrapped in (() => { ... })();`);
  }
});

test("every campus in src/campuses.js has an adapter and fixtures", async () => {
  await import("../src/campuses.js");
  for (const campus of globalThis.PROFCHECK_CAMPUSES.list) {
    assert.ok(existsSync(join(ADAPTER_DIR, `${campus.id}.js`)), `missing src/adapters/${campus.id}.js`);
    assert.ok(fixturePairs(campus.id).length > 0, `missing fixtures in test/fixtures/campuses/${campus.id}/`);
  }
});

function fixturePairs(campusId) {
  const directory = join(FIXTURE_DIR, campusId);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".html"))
    .map((name) => ({
      page: join(directory, name),
      expected: join(directory, name.replace(/\.html$/, ".expected.json"))
    }));
}

const campusIds = readdirSync(FIXTURE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name);

test("adapters return the expected sections for their fixtures", async (t) => {
  const chrome = await launchChrome();
  if (!chrome) {
    // CI must run these; locally a missing Chrome is only a skip.
    assert.ok(!process.env.CI, "Chrome not found in CI; set CHROME_PATH");
    t.skip("Chrome not found; set CHROME_PATH to run adapter fixtures");
    return;
  }

  try {
    const shared = ["src/config.js", "src/parse.js", "src/campuses.js", "src/adapters/registry.js"]
      .map((path) => readFileSync(join(ROOT, path), "utf8"));

    for (const campusId of campusIds) {
      for (const { page, expected } of fixturePairs(campusId)) {
        await t.test(`${campusId}/${page.split("/").pop()}`, async () => {
          assert.ok(existsSync(expected), `missing ${expected}`);
          await chrome.open(pathToFileURL(page).href);
          for (const source of [...shared, readFileSync(join(ADAPTER_DIR, `${campusId}.js`), "utf8")]) {
            await chrome.evaluate(source);
          }
          const actual = await chrome.evaluate(`(() => {
            const defaults = globalThis.PROFCHECK_DEFAULTS;
            const campus = globalThis.PROFCHECK_CAMPUSES.byId(${JSON.stringify(campusId)})
              ?? ${JSON.stringify(TEST_ONLY_CAMPUSES[campusId] ?? null)};
            const ctx = {
              parse: globalThis.PROFCHECK_PARSE,
              campus,
              selectors: {
                courseRow: defaults.courseRowSelector,
                instructor: defaults.instructorSelector,
                courseCode: defaults.courseCodeSelector
              }
            };
            const describe = (node) => node ? (node.id || "(element without id)") : null;
            return globalThis.PROFCHECK_ADAPTERS.get(${JSON.stringify(campusId)}).findSections(document, ctx)
              .map((s) => ({ anchor: describe(s.anchor), row: describe(s.row), courseCode: s.courseCode,
                instructor: s.instructor, unassigned: s.unassigned, seats: s.seats, waitlisted: s.waitlisted }));
          })()`);
          assert.deepEqual(actual, JSON.parse(readFileSync(expected, "utf8")));
        });
      }
    }
  } finally {
    await chrome.close();
  }
});
