// node --test test/scan-fixtures.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { scanText } from "../scripts/scan-fixtures.mjs";

const clean = readFileSync(new URL("./fixtures/scanner/clean.html", import.meta.url), "utf8");

test("a hand-built fixture with made-up values passes", () => {
  assert.deepEqual(scanText(clean), []);
});

const BAD_SAMPLES = {
  "student-ID-like number": "<td>Student 2045871</td>",
  "real email": "<td>jdoe@uh.edu</td>",
  "PeopleSoft session parameter": '<a href="/psc/page?ICSID=abc123">x</a>',
  "token parameter": '<a href="/x?Token=abc">x</a>',
  "SAML response": '<form action="/sso?SAMLResponse=abc">',
  "hidden input with a value": '<input type="hidden" name="ICStateNum" value="7">',
  "hidden input, attributes reordered": "<input value='x' name='a' type=hidden>",
  "script tag": "<script>window.x = 1</script>"
};

for (const [name, sample] of Object.entries(BAD_SAMPLES)) {
  test(`flags ${name}`, () => {
    const findings = scanText(`${clean}\n${sample}\n`);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.equal(findings[0].line, clean.split("\n").length + 1);
  });
}

test("allowlisted numbers only apply to the file that lists them", () => {
  assert.equal(scanText("<td>1234567</td>").length, 1);
});
