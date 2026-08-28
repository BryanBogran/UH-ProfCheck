// Pure text parsing for the section overlay, shared with test/parse.test.mjs.
// Everything here takes strings, never nodes, so it is testable without a DOM.
globalThis.PROFCHECK_PARSE = (() => {
  const COURSE_CODE_PATTERN = /\b([A-Z]{2,5}\s?\d{4})\b/;
  const PROFESSOR_NAME_PATTERN = /^[A-Za-z ,.'-]{4,}$/;
  const PLACEHOLDER_INSTRUCTOR_NAMES = new Set(["to be announced", "tba", "staff"]);

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  /** Exact match only: a substring test also matches names like "Tbachman". */
  function isPlaceholderInstructor(text) {
    return PLACEHOLDER_INSTRUCTOR_NAMES.has(normalizeWhitespace(text).toLowerCase());
  }

  /** A cell can list more than a name; take the first segment shaped like one. */
  function extractProfessorName(text) {
    return normalizeWhitespace(text)
      .split(/[\/;|]/)
      .map((segment) => segment.trim())
      .find((segment) => PROFESSOR_NAME_PATTERN.test(segment)) || "";
  }

  function extractCourseCode(text) {
    const match = normalizeWhitespace(text).toUpperCase().match(COURSE_CODE_PATTERN);
    return match ? match[1].replace(/\s+/, " ") : "";
  }

  /** Number("") and Number(null) are 0, so absence is rejected before coercion. */
  function toFiniteNumber(value) {
    if (value == null || value === "") {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function formatNumber(value) {
    return toFiniteNumber(value)?.toFixed(1) ?? "N/A";
  }

  function formatPercent(value) {
    const numericValue = toFiniteNumber(value);
    return numericValue == null ? "N/A" : `${numericValue.toFixed(1)}%`;
  }

  return {
    normalizeWhitespace, isPlaceholderInstructor, extractProfessorName,
    extractCourseCode, formatNumber, formatPercent
  };
})();
