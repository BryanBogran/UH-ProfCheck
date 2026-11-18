// Example State University: a fake campus used to show contributors a complete,
// working adapter. It is not listed in src/campuses.js and is never shipped.
// Its results page lives in test/fixtures/campuses/example/.
//
// Fake markup, one row per section:
//   <tr class="esu-section" data-section="1001">
//     <td class="esu-course">ESU 1301</td>
//     <td><span class="esu-instructor">Pat Example</span></td>
//     <td class="esu-seats">12/40</td>
//     <td class="esu-status">Open | Closed | Waitlist</td>
//   </tr>
(() => {
  globalThis.PROFCHECK_ADAPTERS.register({
    id: "example",

    findSections(root, ctx) {
      const { parse } = ctx;
      const sections = [];
      const seenSectionNumbers = new Set();

      root.querySelectorAll("tr.esu-section").forEach((row) => {
        // The portal sometimes repeats a section after a re-sort; show it once.
        const sectionNumber = row.dataset.section;
        if (sectionNumber && seenSectionNumbers.has(sectionNumber)) {
          return;
        }
        seenSectionNumbers.add(sectionNumber);

        const anchor = row.querySelector(".esu-instructor");
        if (!anchor) {
          return;
        }

        const unassigned = parse.isPlaceholderInstructor(anchor.textContent);
        const instructor = unassigned ? null : parse.extractProfessorName(anchor.textContent) || null;
        if (!unassigned && !instructor) {
          return;
        }

        const status = parse.normalizeWhitespace(row.querySelector(".esu-status")?.textContent).toLowerCase();
        sections.push({
          anchor,
          row,
          courseCode: parse.extractCourseCode(row.querySelector(".esu-course")?.textContent) || null,
          instructor,
          unassigned,
          seats: readSeats(row.querySelector(".esu-seats")?.textContent),
          waitlisted: status ? status === "waitlist" : null
        });
      });

      return sections;
    }
  });

  /** "12/40" → { open: 12, total: 40 }; anything else is unknown, never guessed. */
  function readSeats(text) {
    const match = String(text || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    return match ? { open: Number(match[1]), total: Number(match[2]) } : null;
  }
})();
