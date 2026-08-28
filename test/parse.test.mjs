// node --test test/parse.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

await import("../src/parse.js");
const {
  normalizeWhitespace, isPlaceholderInstructor, extractProfessorName,
  extractCourseCode, formatNumber, formatPercent
} = globalThis.PROFCHECK_PARSE;

test("whitespace collapses and trims, including newlines and tabs", () => {
  assert.equal(normalizeWhitespace("  Melahat\n\tAlmus  "), "Melahat Almus");
  assert.equal(normalizeWhitespace(null), "");
  assert.equal(normalizeWhitespace(undefined), "");
});

test("placeholder instructors match exactly, never as substrings", () => {
  for (const text of ["TBA", "tba", " To Be Announced ", "Staff"]) {
    assert.ok(isPlaceholderInstructor(text), text);
  }
  // The bug an unanchored /tba/ would reintroduce.
  assert.ok(!isPlaceholderInstructor("Tbachman"));
  assert.ok(!isPlaceholderInstructor("Staffordshire"));
  assert.ok(!isPlaceholderInstructor(""));
});

test("a name is pulled out of a cell that carries more than the name", () => {
  assert.equal(extractProfessorName("Melahat Almus"), "Melahat Almus");
  assert.equal(extractProfessorName("Ann Patricia O'Bryan"), "Ann Patricia O'Bryan");
  assert.equal(extractProfessorName("Jesse J. Rainbow"), "Jesse J. Rainbow");
  assert.equal(extractProfessorName("Ramamurthy, Uma"), "Ramamurthy, Uma");
  // Whitespace collapses before the split, so only / ; | separate fields.
  assert.equal(extractProfessorName("Carlos Ordonez | MW 10:00AM"), "Carlos Ordonez");
  assert.equal(extractProfessorName("Smith / Jones"), "Smith");
});

test("segments that are not names are rejected", () => {
  assert.equal(extractProfessorName("PGH 232"), "");
  assert.equal(extractProfessorName("Li"), "", "under four characters");
  assert.equal(extractProfessorName(""), "");
});

test("course codes are found and normalised", () => {
  assert.equal(extractCourseCode("MATH 2414"), "MATH 2414");
  assert.equal(extractCourseCode("cosc 3340"), "COSC 3340");
  assert.equal(extractCourseCode("MATH2414"), "MATH2414");
  assert.equal(extractCourseCode("Calculus II"), "");
  assert.equal(extractCourseCode("Lecture - 19187"), "");
});

test("figures format to one decimal, and absent values read N/A", () => {
  assert.equal(formatNumber(4.25), "4.3");
  assert.equal(formatNumber(3), "3.0");
  assert.equal(formatPercent(9.62), "9.6%");
  for (const empty of [null, undefined, "", "n/a"]) {
    assert.equal(formatNumber(empty), "N/A", String(empty));
    assert.equal(formatPercent(empty), "N/A", String(empty));
  }
});
