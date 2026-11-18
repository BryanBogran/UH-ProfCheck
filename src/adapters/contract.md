# Campus adapter contract

An adapter teaches ProfCheck to read one campus's course-search results. It is a single file, `src/adapters/<campus-id>.js`, that **only reads the page** and returns a list of sections. The shared engine in `src/content.js` does everything else: rendering, seat notices, lookups, rankings, refresh handling, settings, and permissions.

Start from [`_template.js`](_template.js). [`example.js`](example.js) is a complete adapter for a fake campus, with fixtures in `test/fixtures/campuses/example/`.

## Where things live

| What | File |
|---|---|
| Campus metadata: id, display name, exact HTTPS host, optional path pattern, `allFrames`, status, features, data sources | `src/campuses.js` (Bryan approves every change) |
| Page parsing | `src/adapters/<campus-id>.js` |
| Synthetic test pages and expected output | `test/fixtures/campuses/<campus-id>/` |

The engine picks the adapter from the page's URL: `PROFCHECK_CAMPUSES.campusForUrl(location.href)` gives the campus, and its `id` selects the adapter. A UH page can never use another campus's adapter, and the reverse.

## The adapter object

```js
(() => {
  globalThis.PROFCHECK_ADAPTERS.register({
    id: "example",                    // same id as in src/campuses.js
    findSections(root, ctx) { ... },  // required
    findCourseHeaders(root, ctx) { ... } // optional; only used by campuses with grade data
  });
})();
```

Wrap the file in `(() => { ... })();`. All content scripts share one global scope, so top-level helpers would collide with other adapters'.

### `findSections(root, ctx)` → `Section[]`

`root` is the `Document` to read. `ctx` contains:

- `parse`: helpers from `src/parse.js` (`normalizeWhitespace`, `isPlaceholderInstructor`, `extractProfessorName`, `extractCourseCode`).
- `selectors`: the UH selector settings (`courseRow`, `instructor`, `courseCode`). Other campuses hard-code their selectors in the adapter.
- `campus`: this campus's entry from `src/campuses.js`.

Each section:

| Field | Type | Meaning |
|---|---|---|
| `anchor` | `Element` | The instructor element. The overlay is inserted right after it, so it should be an inline element inside a cell, not a `<td>` or `<tr>`. |
| `row` | `Element \| null` | The element that holds the whole section. Used for row highlights and to keep one chip set per instructor per row. |
| `courseCode` | `string \| null` | Like `"COSC 1336"`. |
| `instructor` | `string \| null` | Display name. `null` when unassigned or unreadable. |
| `unassigned` | `boolean` | `true` for "TBA", "Staff", or "To Be Announced". |
| `seats` | `{ open, total } \| null` | Whole numbers as shown on the page. `null` if not shown or not readable. |
| `waitlisted` | `boolean \| null` | `true` if the page says the section is waitlisted. `null` if the page doesn't say. |

**Unknown stays unknown.** Return `null` rather than a guess. A wrong seat count is worse than none.

Return each section once. If the portal repeats a row, de-duplicate it in the adapter (see `example.js`).

### `findCourseHeaders(root, ctx)` → `{ anchor, courseCode }[]` (optional)

Course-title elements above a results table. The engine adds a course link next to them, but only for campuses whose `dataSources` include a grade source. Pilot campuses leave this out.

## What the engine checks

Before rendering, the engine drops a section when:

- `anchor` is missing, detached, or already used by another section;
- `instructor` is `null` and `unassigned` is `false`;
- `seats` is present but `open` or `total` is not a whole number ≥ 0, `total` is 0, or `open > total`;
- `waitlisted` is not `true`, `false`, or `null`.

If **more than half** of a page's sections are dropped, or `findSections` throws, the engine shows **nothing** on that page and logs one warning tagged `[ProfCheck:<campus-id>]`. Showing nothing is better than showing wrong data.

## What an adapter may not do

`test/adapters.test.mjs` fails if an adapter file mentions any of these:

`fetch`, `XMLHttpRequest`, `WebSocket`, `chrome.`, `browser.`, `eval`, `Function(`, `import(`, `importScripts`, `setTimeout`, `setInterval`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `postMessage`, `sendBeacon`.

The engine reruns `findSections` whenever the page changes, so an adapter never needs timers or observers.

## Features and data

What a campus shows comes from its `features` and `dataSources` in `src/campuses.js`, not from the adapter:

- With `dataSources: []`, the engine sends **no lookups** and shows course, instructor, and seat information only.
- Grades, ratings, and rankings are hidden unless the campus has an approved data source and the matching feature.
- `ratingsLink` with `rmpSchoolId` shows a "Search RMP" link for each named instructor whenever no rating is shown. The link is built from the instructor's name, and nothing is sent until the student clicks it. Any campus can have it, including one with `dataSources: []`.

## Testing

For each fixture page `test/fixtures/campuses/<id>/<name>.html`, add `<name>.expected.json` with the sections `findSections` should return. In that file, each section's `anchor` and `row` are written as the element's `id` attribute, so give those elements ids in the fixture. `npm test` runs every adapter on its fixtures in headless Chrome.

Fixtures must be **built by hand with made-up data**: no saved portal pages, real names, student IDs, emails (other than `@example.edu`), scripts, hidden form values, or session URLs. `npm run scan` checks this.
