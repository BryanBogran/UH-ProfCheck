// node --test test/browser.test.mjs
// Runs the in-browser fixture pages (real extension scripts, stubbed APIs) in
// headless Chrome and fails on any failed check. Skips when Chrome is missing,
// except in CI (CI env var set), where a missing Chrome fails.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import test from "node:test";
import { launchChrome } from "./helpers/chrome.mjs";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");
const PAGES = [
  "release-check.html", "engine-uh.html", "engine-pilot.html",
  "engine-uh-disabled.html", "engine-none.html"
];

test("browser fixture pages pass", async (t) => {
  const chrome = await launchChrome();
  if (!chrome) {
    // CI must run these; locally a missing Chrome is only a skip.
    assert.ok(!process.env.CI, "Chrome not found in CI; set CHROME_PATH");
    t.skip("Chrome not found; set CHROME_PATH to run browser fixtures");
    return;
  }

  try {
    for (const page of PAGES) {
      await t.test(page, async () => {
        await chrome.open(pathToFileURL(join(FIXTURES, page)).href);
        const failed = await chrome.waitFor("document.querySelector('#summary')?.dataset.failed ?? null");
        const report = await chrome.evaluate(`[document.querySelector('#summary').textContent,
          ...[...document.querySelectorAll('#checks .fail')].map((n) => n.textContent),
          document.querySelector('#errors')?.textContent || ''].filter(Boolean).join('\\n')`);
        assert.equal(failed, "0", report);
      });
    }
  } finally {
    await chrome.close();
  }
});
