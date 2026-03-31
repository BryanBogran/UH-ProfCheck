Project roadmap and implementation notes

Repo:
- Professor Overlay / UH-ProfCheck

Current extension shape:
- `manifest.json`
  - MV3 extension config
  - content script on `https://saprd.my.uh.edu/*`
  - background service worker
  - options page
- `src/content.js`
  - scans the UH enrollment page
  - detects instructor and course-code nodes
  - injects inline chips
- `src/background.js`
  - fetches CougarGrades and RateMyProfessor data
  - normalizes responses
  - caches lookups in memory
- `src/content.css`
  - styles row-level chips
- `options/options.*`
  - stores user settings in `chrome.storage.sync`

Goal:
- Keep this as a lightweight UH registration assistant.
- Use the live UH page DOM for current section data.
- Use CougarGrades API for professor/course history and quality signals.
- Avoid turning the extension into a giant planner app.

Useful CougarGrades integrations

Confirmed useful data sources:
- `GET https://api.cougargrades.io/api/instructor/{instructorName}`
  - good for professor summary cards
  - includes badges, enrollment, related courses, top courses, first/last taught
- `GET https://api.cougargrades.io/api/course/{courseName}`
  - best source for compare and scoring features
  - includes historical section rows in `dataGrid.rows`
  - includes GPA, drop rate, course metadata, seasonal availability, related instructors
- `GET https://api.cougargrades.io/api/external/rmp/search`
  - current source for RMP summary stats

Confirmed not useful as direct dependencies:
- `cougargrades/web`
  - too heavy and monorepo-based for this no-build extension
- `cougargrades/collegescheduler`
  - archived and proxy-based, not appropriate for Chrome Web Store use
- `cougargrades/peoplesoft`
  - still too thin/WIP to depend on directly

Recommended implementation order

Tier 1:
- normalized section model
- shortlist storage
- planner tray
- compare selected sections

Tier 2:
- scoring modes
- course-level CougarGrades integration
- read-only shopping cart awareness

Tier 3:
- schedule drafting engine
- professor summary popover
- confidence badges and error states

Feature list with implementation details

1. Normalized section data model

What it is:
- Build a consistent `section` object for every row detected on the UH page.
- This becomes the base object used by compare, shortlist, scoring, cart awareness, and schedule drafting.

Why it is feasible:
- The current content script already finds instructor and course nodes.
- The missing piece is extracting more row-level fields from the PeopleSoft DOM.

Primary files:
- `src/content.js`
- `src/background.js`

Recommended new files:
- `src/models.js`
  - export object-shape helpers and normalizers
- `src/dom-parsers.js`
  - extract section metadata from UH row DOM nodes

Implementation notes:
- In `src/content.js`, replace ad hoc professor-only processing with per-row section extraction.
- Build a normalized shape like:

```js
{
  sectionKey,
  classNumber,
  sectionNumber,
  courseCode,
  title,
  instructorName,
  normalizedInstructorName,
  meetingDays,
  startTime,
  endTime,
  timeText,
  location,
  seatsOpen,
  status,
  inCart,
  rowSignature,
  rmp: null,
  cougarGradesInstructor: null,
  cougarGradesCourse: null,
  confidence: {},
  scores: {}
}
```

Integration:
- `src/content.js`
  - detect course rows
  - call DOM parser helpers
  - attach the section object to each rendered row
- `src/background.js`
  - support fetching course-level CougarGrades data in addition to instructor lookups

Open dependency:
- We still need the real UH row DOM structure for reliable extraction of:
  - class number
  - meeting times
  - seats open
  - shopping cart state

2. Compare selected sections

What it is:
- Let users compare sections for the same course in a compact tray or side panel.

Why it is feasible:
- CougarGrades course endpoint already returns historical section outcomes.
- The extension can combine those with current-page section rows.

Primary files:
- `src/content.js`
- `src/content.css`

Recommended new files:
- `src/planner-ui.js`
  - render compare tray and planner UI
- `src/scoring.js`
  - scoring functions used by compare view

Implementation notes:
- Add a compare action per row, likely a small `Compare` button or icon.
- Group rows by `courseCode`.
- Show columns such as:
  - instructor
  - RMP
  - GPA
  - W rate
  - seats open
  - meeting time
  - score
- Use current page DOM for live row data.
- Use CougarGrades `/api/course/{courseName}` for course history and section stats.

Integration:
- `src/content.js`
  - add compare button to each row overlay
  - collect selected sections into local planner state
- `src/background.js`
  - add `LOOKUP_COURSE` message handler
  - cache course lookups by normalized course code
- `src/content.css`
  - add planner tray and compare table styles

3. Shortlist storage and planner tray

What it is:
- Let users save sections they are considering.
- Show them in a persistent planner tray on the page.

Why it is feasible:
- This is self-contained and does not depend on risky automation.

Primary files:
- `src/content.js`
- `src/content.css`

Recommended new files:
- `src/storage.js`
  - wrapper for shortlist read/write helpers in `chrome.storage.local`
- `src/planner-ui.js`

Implementation notes:
- Use `chrome.storage.local` rather than `sync` for shortlist and cached section data.
- Add a `Save` or star action on each row.
- Planner tray should show:
  - saved sections
  - cart status if known
  - quick compare actions
  - draft schedule results later

Integration:
- `src/content.js`
  - add save/unsave UI
  - hydrate shortlist on page load
- `src/content.css`
  - add compact tray UI styles
- `options/options.js`
  - optionally add a toggle to enable/disable planner tray

4. Scoring modes

What it is:
- Transparent weighted scores for:
  - Balanced
  - Easiest A
  - Best Teaching
  - Lowest Risk

Why it is feasible:
- Current API data already supports the main factors.
- This is pure logic and low-risk to implement.

Primary files:
- `src/background.js`

Recommended new files:
- `src/scoring.js`

Implementation notes:
- Compute scores from:
  - RMP rating
  - RMP difficulty
  - RMP rating count
  - CougarGrades GPA
  - CougarGrades drop rate
  - recency of data
  - completeness/confidence
- Keep weights easy to tweak in one place.

Integration:
- `src/scoring.js`
  - export scoring profiles and helper functions
- `src/content.js`
  - render one-line score summary on rows or in compare view
- `options/options.js`
  - add default ranking mode later if needed

5. Course-level CougarGrades integration

What it is:
- Enrich each row with course-level historical context from CougarGrades.

Why it is feasible:
- `/api/course/{courseName}` is public and structured.
- This is the strongest external integration for compare/ranking.

Primary files:
- `src/background.js`

Implementation notes:
- Add course lookup support alongside professor lookup.
- Cache by normalized `courseCode`.
- Extract relevant fields only:
  - course badges
  - related instructors
  - seasonal availability
  - recent historical `dataGrid.rows`

Integration:
- `src/background.js`
  - add `fetchCourse(courseCode, config)`
  - add cache key based on course code
  - return compact normalized course payload
- `src/content.js`
  - request course data once per course code
  - merge into section model for compare/scoring UI

6. Professor summary popover

What it is:
- Click a chip to open a compact summary card instead of only linking out.

Why it is feasible:
- Instructor endpoint already provides enough summary data for a useful card.

Primary files:
- `src/content.js`
- `src/content.css`

Recommended new files:
- `src/popover.js`

Implementation notes:
- Keep row chips compact.
- On click, open a small card with:
  - RMP rating
  - difficulty
  - would-take-again
  - CougarGrades GPA
  - drop rate
  - first/last taught
  - top courses taught

Integration:
- `src/content.js`
  - convert some chip actions into popover triggers
- `src/content.css`
  - style popover and close behavior
- `src/background.js`
  - no major new API needed beyond richer use of existing instructor data

7. Confidence indicators

What it is:
- Show small warnings when the data quality is weak or ambiguous.

Why it is feasible:
- Most confidence signals can be derived from existing data.

Primary files:
- `src/content.js`
- `src/scoring.js`

Implementation notes:
- Flags can include:
  - low review count
  - no recent course history
  - no instructor match
  - CougarGrades only
  - missing time / TBA
  - ambiguous row parse

Integration:
- attach confidence flags to the normalized section object
- surface them in compare view or popover

8. Shopping cart awareness

What it is:
- Detect whether a section is already in the UH shopping cart.

Why it is only partially feasible now:
- Read-only detection is likely feasible.
- Writing into the cart automatically is much riskier and should be deferred.

Primary files:
- `src/content.js`
- `src/dom-parsers.js`

Implementation notes:
- Detect cart state from row text, button labels, or nearby status elements.
- Expose:
  - `inCart: true/false`
  - optional `cartStatusText`
- Show `In Cart` in row UI and planner tray.

Integration:
- `src/content.js`
  - parse cart state during row extraction
  - show badge in overlay/tray

Do not implement yet:
- automatic add-to-cart actions
- button clicking flows against PeopleSoft unless the DOM is proven stable

9. Schedule drafting engine

What it is:
- Generate the best non-conflicting combination from shortlisted or selected sections.

Why it is conditionally feasible:
- The optimizer is easy to write.
- The hard dependency is reliable extraction of meeting days/times from the UH page.

Primary files:
- `src/scoring.js`
- `src/planner-ui.js`

Recommended new files:
- `src/schedule.js`

Implementation notes:
- Input:
  - shortlisted or selected section objects
- Process:
  - group by course
  - generate combinations
  - reject time conflicts
  - rank remaining schedules by scoring mode
- Handle:
  - TBA times
  - multiple meetings per section
  - missing time data

Integration:
- `src/schedule.js`
  - conflict detection
  - schedule generation
  - ranking
- `src/planner-ui.js`
  - show top schedule candidates

Blocker:
- Must confirm UH DOM exposes meeting times cleanly enough for reliable normalization.

10. Settings page cleanup

What it is:
- Make options usable for normal users while preserving advanced controls.

Why it is feasible:
- Existing options page is small and easy to reorganize.

Primary files:
- `options/options.html`
- `options/options.js`
- `options/options.css`

Implementation notes:
- Split settings into:
  - Basic
  - Advanced
- Basic:
  - show RMP chips
  - show CougarGrades chips
  - enable planner tray
  - default ranking mode
- Advanced:
  - selectors
  - URL patterns
  - debug tools
  - clear cache

Implementation recommendations by file

`manifest.json`
- keep permissions minimal
- likely no new permissions needed for shortlist/compare/planner tray
- only add permissions if a feature absolutely requires them

`src/content.js`
- biggest file to refactor
- move from professor-node rendering to row-based section extraction
- own:
  - row parsing kickoff
  - planner tray mounting
  - compare buttons
  - save/cart badges
  - chip rendering
  - popover triggers

`src/background.js`
- expand from professor lookup to:
  - instructor lookup
  - course lookup
  - richer response normalization
  - more robust cache keys
- candidate cache key dimensions:
  - professor name
  - course code
  - enabled data sources

`src/content.css`
- expand beyond chip styles to include:
  - planner tray
  - compare table
  - popover
  - status badges
- keep the visual style compact and quiet

Recommended new modules

`src/models.js`
- normalized data shapes
- helper constructors

`src/dom-parsers.js`
- UH row parsing
- text cleanup
- cart/time extraction helpers

`src/storage.js`
- shortlist persistence
- cached UI state

`src/scoring.js`
- weighted profiles
- confidence helpers

`src/schedule.js`
- conflict detection
- schedule generation

`src/planner-ui.js`
- shortlist tray
- compare UI
- schedule results

`src/popover.js`
- professor and course summary cards

What should not be built right now

- generic multi-school support
- direct dependency on CougarGrades monorepo packages
- local proxy/re-auth flows like `collegescheduler`
- automatic shopping-cart submission flows
- oversized planner/calendar UI

Best next coding slice

The cleanest next implementation is:
- normalized section model
- `LOOKUP_COURSE` support in `src/background.js`
- shortlist storage in `chrome.storage.local`
- planner tray UI
- compare selected sections using current page rows plus CougarGrades course data

That gives the extension a strong base without overcommitting to brittle PeopleSoft automation.
