// TEMPLATE: copy to src/adapters/<campus-id>.js and replace every TODO.
// Read src/adapters/contract.md first; src/adapters/example.js is a complete example.
//
// Rules (checked by test/adapters.test.mjs and by review):
// - Read the page only. No network requests, extension APIs, storage, cookies,
//   timers, eval, or dynamic imports. The shared engine does all of that.
// - Return null for anything you cannot read reliably. Never guess.
// - Keep everything inside this function so your helpers cannot collide with
//   another adapter's (all content scripts share one global scope).
(() => {
  globalThis.PROFCHECK_ADAPTERS.register({
    // Must match the campus id in src/campuses.js.
    id: "TODO-campus-id",

    /**
     * @param {Document} root The page (or frame) to read.
     * @param {{ parse: object, selectors: object, campus: object }} ctx
     *   parse: helpers from src/parse.js (normalizeWhitespace, isPlaceholderInstructor,
     *   extractProfessorName, extractCourseCode).
     * @returns {Array<{
     *   anchor: Element,            // overlay is inserted right after this element
     *   row: Element | null,        // the element holding the whole section
     *   courseCode: string | null,  // "ABCD 1234"
     *   instructor: string | null,  // display name, null when unassigned or unreadable
     *   unassigned: boolean,        // true for "TBA" / "Staff"
     *   seats: { open: number, total: number } | null,
     *   waitlisted: boolean | null
     * }>}
     */
    findSections(root, ctx) {
      const { parse } = ctx;
      const sections = [];

      // TODO: select one element per section on your portal's results page.
      root.querySelectorAll("TODO-row-selector").forEach((row) => {
        const anchor = row.querySelector("TODO-instructor-selector");
        if (!anchor) {
          return;
        }

        const unassigned = parse.isPlaceholderInstructor(anchor.textContent);
        sections.push({
          anchor,
          row,
          courseCode: parse.extractCourseCode(row.querySelector("TODO-course-selector")?.textContent) || null,
          instructor: unassigned ? null : parse.extractProfessorName(anchor.textContent) || null,
          unassigned,
          seats: null,      // TODO: { open, total } when the page shows both numbers
          waitlisted: null  // TODO: true / false when the page says so
        });
      });

      return sections;
    }
  });
})();
