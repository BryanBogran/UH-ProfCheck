// University of Houston adapter: PeopleSoft Campus Solutions class search on
// saprd.my.uh.edu. Read-only: it finds sections in the page and returns them.
// Selectors come from ctx.selectors so the user-editable settings still apply.
// Wrapped in a function: content scripts share one global scope, so helpers
// declared at the top level would collide with other adapters'.
(() => {
  globalThis.PROFCHECK_ADAPTERS.register({
    id: "uh",

    findSections(root, ctx) {
      const { selectors, parse } = ctx;
      const sections = [];
      const seenAnchors = new Set();

      const consider = (node) => {
        if (seenAnchors.has(node)) {
          return;
        }

        // Only an explicit "TBA"/"Staff" cell is a placeholder; an unparseable name
        // is just a cell we cannot use yet.
        const unassigned = parse.isPlaceholderInstructor(node.textContent);
        const instructor = unassigned ? null : parse.extractProfessorName(node.textContent) || null;
        if (!unassigned && !instructor) {
          return;
        }

        const courseCode = extractRowCourseCode(node, selectors, parse) || null;
        if (unassigned && !courseCode) {
          return;
        }

        const row = node.closest(selectors.courseRow);
        seenAnchors.add(node);
        sections.push({
          anchor: node,
          row,
          courseCode,
          instructor,
          unassigned,
          seats: tightestSeats(row),
          waitlisted: null
        });
      };

      root.querySelectorAll(selectors.instructor).forEach((node) => {
        // instructorSelector matches on an id substring, so PeopleSoft's wrapper span
        // matches alongside the name span inside it. The innermost node owns the
        // chips; an ancestor would render them away from the name it describes.
        if (!node.querySelector(selectors.instructor)) {
          consider(node);
        }
      });

      // Rows without an instructor element still carry a "TBA"/"Staff" text cell.
      root.querySelectorAll(selectors.courseRow).forEach((row) => {
        if (row.querySelector(selectors.instructor)) {
          return;
        }

        const placeholderNode = findPlaceholderInstructorNode(row, parse);
        if (placeholderNode) {
          consider(placeholderNode);
        }
      });

      return sections;
    },

    /** Course headers above a results table; the engine links them to grade data. */
    findCourseHeaders(root, ctx) {
      const { selectors, parse } = ctx;
      return [...root.querySelectorAll(selectors.courseCode)]
        .filter(isCourseHeaderNode)
        .map((anchor) => ({ anchor, courseCode: parse.extractCourseCode(anchor.textContent) || null }));
    }
  });

  // A row can list a lecture and its lab; the tightest count is the one that limits enrollment.
  function tightestSeats(row) {
    if (!row) {
      return null;
    }

    let tightest = null;
    for (const match of row.textContent.matchAll(/Open Seats (\d+) of (\d+)/g)) {
      const open = Number(match[1]);
      const total = Number(match[2]);
      if (total && (!tightest || open < tightest.open)) {
        tightest = { open, total };
      }
    }
    return tightest;
  }

  /** Innermost match wins: a nested cell is more specific than its container. */
  function findPlaceholderInstructorNode(row, parse) {
    const candidates = row.querySelectorAll("td, span, div");
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      if (parse.isPlaceholderInstructor(candidates[index].textContent)) {
        return candidates[index];
      }
    }

    return null;
  }

  /** Course-detail tables keep their single course header above the rows. */
  function extractRowCourseCode(node, selectors, parse) {
    const row = node.closest(selectors.courseRow);
    const courseCodeNode = row?.querySelector(selectors.courseCode);
    if (courseCodeNode) return parse.extractCourseCode(courseCodeNode.textContent);
    const body = node.ownerDocument.body;
    for (let parent = row?.parentElement; parent && parent !== body; parent = parent.parentElement) {
      const codes = new Set([...parent.querySelectorAll(selectors.courseCode)]
        .filter(isCourseHeaderNode)
        .map((header) => parse.extractCourseCode(header.textContent)).filter(Boolean));
      if (codes.size === 1) return [...codes][0];
      if (codes.size > 1) break;
    }
    return "";
  }

  function isCourseHeaderNode(node) {
    return !node.closest("tr, table, [role='row'], .ps_grid-row");
  }
})();
