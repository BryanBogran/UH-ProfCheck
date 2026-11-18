# ProfCheck multi-campus launch plan

Written 2026-11-17. This plan covers the work from today until the first non-UH campus is live in the official Chrome Web Store listing, with UH still working. The decisions it relies on are in [brainstorm.md](brainstorm.md#campus-contributor-program-2026-11-17). Check items off here as they're done.

**Launch** means a version on the Chrome Web Store in which:
- UH users see no change except a new "Campuses" section in settings.
- One pilot campus (Lone Star or Texas Tech) can be switched on, shows course and instructor detection and low-seat notices, and never sends a network request.
- A new contributor could repeat the process for a third campus without help from Bryan.

## Status (2026-11-17)

| Step | State |
|---|---|
| 0 Clean starting point | Done: 0.2.0 confirmed live; changes committed on `v2` |
| A1 Agreement draft | Drafted in `CLA.md`, marked DRAFT. Waiting on legal review (A2) and chaseum (A3) |
| A4 Signing workflow | `.github/workflows/cla.yml` written. **Bryan:** repo settings and `cla-signatures` branch (see the comments in the file) |
| B1 Tooling and CI | Done: `package.json`, `.github/workflows/ci.yml`, `scripts/check-manifests.mjs` |
| B2 Repo settings | **Bryan:** not started |
| B3 Fixture scanner | Done: `scripts/scan-fixtures.mjs` with tests |
| B4 Template and example campus | Done: `src/adapters/_template.js`, `example.js`, fixtures |
| B5 Contributor docs | Done: `CONTRIBUTING.md`, `CAMPUSES.md`, issue forms, PR template, credits |
| C1–C4 Contract, UH adapter, output checks, seat chips | Done. Behavior changes: seat chips render before lookups, "Full" at 0 open, "Instructor TBA" also shown after a failed course lookup |
| C5 Settings | Done. Simplified: selectors stay as they are in storage, with no migration |
| C6 Background gating | Done |
| C7 Campus switches and permissions | Done: `src/campus-access.js`. The full switch-on flow can only be tried in a browser once a non-UH campus exists |
| Launcher campus awareness, CI Chrome | Done. The launcher hides on pages with no campus or a disabled campus, shows the campus note, and hides rankings and dark mode where they don't apply |
| C8 Release gates | Automated part done: 77/77 tests, ZIP inspected (27 files, no tests, no template or example adapter). **Bryan:** bump the version to 0.3.0, check live UH, and test the upgrade from 0.2.0 in real Chrome |
| D1 Discovery checklist | Written: `docs/discovery-checklist.md`. **Bryan:** send it to the volunteer |

**Owners:** **B** = Bryan only (accounts, legal, approvals, store). **C** = code work Claude can do with Bryan reviewing. **V** = the volunteer / campus maintainer. **T** = a second campus tester.

---

## Overview and order

There are five tracks. A, B and D can start today in parallel. C needs B's test setup. E needs everything else.

```
A. Rights & legal ─────────────────────────────┐
B. Repo & contributor kit ──┬──────────────────┤
                            └─> C. Engine (0.3.0, UH only) ──> E. Pilot campus (0.4.0) ──> LAUNCH
D. Pilot qualification ────────────────────────┘
```

**Two releases instead of one.** First ship the engine refactor to UH users alone as **0.3.0**, then add the pilot campus in **0.4.0**. The refactor touches every UH page. Shipping it on its own means that if something breaks, you know it's the refactor and not the pilot, and you can roll back without pulling a campus. This is the main change from the original milestone list. Milestones 1–3 of that list map onto tracks B and C, milestone 4 onto E1–E3, and milestone 5 onto E4–E6.

---

## Track 0 — Clean starting point (B, today)

- [ ] **0.1** Commit or discard the uncommitted changes on `v2`: `README.md`, `pages/privacy.html`, three store-asset JPGs, `docs/brainstorm.md`, `docs/launch-plan.md`.
- [ ] **0.2** Confirm 0.2.0 is live on the Chrome Web Store. `docs/RELEASE-CHECK.md` notes the listing still showed 0.1.1 during review. If it isn't live, finish that submission first: every later version builds on 0.2.0, and the plan's upgrade test assumes 0.2.0 is what users have.
- [ ] **0.3** Confirm the hosted privacy policy matches `pages/privacy.html` (the open item from the 0.2.0 release check).
- [ ] **0.4** Merge `v2` into `main`, or decide which branch future pull requests target. Contributors need one obvious base branch. Recommendation: `main`.

**Done when:** `main` matches what's in the store, and the working tree is clean.

---

## Track A — Rights and legal (B)

Must finish before the **first outside pull request is merged**. It doesn't block code work.

- [ ] **A1. Draft the contributor agreement** (`CLA.md` at the repo root). It must cover:
  - a non-exclusive, perpetual, irrevocable, worldwide, royalty-free license to Bryan to use, modify, distribute, sublicense and relicense, including commercially;
  - the contributor keeps ownership of their work;
  - a statement that the contributor has the right to submit the work (it's theirs, or their employer or school allows it);
  - a statement that the contributor is 18 or older;
  - no warranty either way.

  A good starting point is the Apache Individual CLA, trimmed down. *(C can draft it. B owns it.)*
- [ ] **A2. Legal review.** Send the draft to a law-school clinic (UH Law has entrepreneurship/IP clinics) or a lawyer for one review. Ask specifically: does it let me sell the project later, and does a GitHub comment count as a valid signature?
- [ ] **A3. Sign with chaseum.** Send them `CLA.md` and ask them to sign by commenting on a dedicated issue or pull request. If they decline, list the files containing their 7 commits (`git log --author=chaseloganbeeler`) and plan rewrites.
- [ ] **A4. Set up CLA Assistant Lite** (`.github/workflows/cla.yml`). Signatures are stored in the repo, for example `signatures/cla.json`, on a branch only Bryan can write. Add yourself and chaseum to the allowlist once signed. *(C writes the workflow. B adds the token secret.)*
- [ ] **A5. Test the agreement check** from a second GitHub account or a friend's account. An unsigned pull request is blocked. After the signing comment, the check passes.

**Done when:** a test pull request from another account is blocked until signed, then passes.

---

## Track B — Repo and contributor kit (C, with B approving)

Covers milestone 1 of the original plan, adapted for the public repo.

### B1. Test tooling
- [ ] Add a minimal `package.json` with no runtime dependencies, scripts only:
  - `test` → `node --test test/`
  - `scan` → fixture scanner (B3)
  - `package` → `python3 scripts/package-release.py`
  - `check` → test + scan + manifest checks
- [ ] Add `.github/workflows/ci.yml` to run `npm run check` on every push and pull request.
- [ ] **Done when:** CI is green on `main` with the existing 31 tests.

### B2. Repo settings (B)
- [ ] Repo stays public. Only Bryan has write access, so contributors use forks.
- [ ] On `main`, turn on branch protection (free for public repos): require a pull request, require CI and the agreement check to pass, no force pushes. Admin bypass is allowed for Bryan's own releases.
- [ ] Optional: add `.github/CODEOWNERS` with `* @BryanBogran`.

### B3. Fixture scanner (`scripts/scan-fixtures.mjs`)
- [ ] Fails on any file under `test/fixtures/campuses/` that contains:
  - 6+ digit numbers that look like student IDs (allowlisted fake IDs like `0000000` pass);
  - email addresses (except `@example.edu`);
  - URL parameters named like session or token (`ICSID`, `PSJSESSIONID`, `token`, `sid`, `session`, `SAMLResponse`, etc.);
  - `<input type="hidden">` with a non-empty value;
  - `<script>` tags.
- [ ] Prints the file, line, and reason. Runs in `npm run check`.
- [ ] Tests for the scanner itself: one clean fixture passes, and one bad fixture per rule fails.

### B4. Adapter template and fake campus
- [ ] `src/adapters/_template.js`: a commented skeleton of the adapter contract (see C1).
- [ ] `src/adapters/example.js`: a working adapter for a fake "Example State University". Not registered in release builds.
- [ ] `test/fixtures/campuses/example/results.html`: a synthetic results page with these cases:
  - normal rows;
  - an unassigned instructor;
  - a duplicate row;
  - a malformed seat count;
  - a full section;
  - a waitlisted section.
- [ ] `test/fixtures/campuses/example/expected.json`: the rows the parser should return.
- [ ] `test/adapters.test.mjs`: loads every adapter, runs its parser on its fixtures, and compares the result to `expected.json`. It also runs the shared output checks (C3).
- [ ] **Acceptance (from the original plan):** change one expected seat number and the test fails with a readable diff.

### B5. Contributor documents
- [ ] `CONTRIBUTING.md`, which must include:
  - who owns what, and that Bryan approves every merge;
  - the nine-step contributor flow from brainstorm.md;
  - setup: clone the fork, `npm test`, load unpacked in Chrome;
  - **fixture rules:** build by hand, made-up names and IDs, no scripts, no hidden values, no session URLs, never paste a raw saved portal page;
  - what an adapter may and may not do (read the page only; no `fetch`, storage, timers that poll the network, or `eval`);
  - the release checklist link;
  - the agreement, and that it's required on the first pull request;
  - the 14-day pause rule;
  - how credit works (name or handle in `CAMPUSES.md` and release notes, with consent).
- [ ] `CAMPUSES.md`: the directory of supported campuses, with status (testing / beta / supported / paused), maintainer handle, supported features, and the version it was added in.
- [ ] `.github/ISSUE_TEMPLATE/campus-request.yml`: school, campus, portal hostname, GitHub handle, course-search access (y/n), can test after launch (y/n), second tester's handle, and a checkbox "I will not post student data".
- [ ] `.github/ISSUE_TEMPLATE/test-report.yml`: build commit, Chrome version, campus, pass/fail for each scenario listed in brainstorm.md, notes, and redacted screenshots allowed.
- [ ] `.github/ISSUE_TEMPLATE/campus-broken.yml`: for layout-change reports. Bryan starts the 14-day pause clock when it's opened.
- [ ] `.github/pull_request_template.md`: a checklist covering the agreement, `npm run check` passing, fixtures by hand, the manifest change being only the approved host, and a link to the campus request issue.
- [ ] "Founded by Bryan Bogran" in `README.md`, `docs/README.md`, and the options page footer.
- [ ] **B (Bryan):** send early collaborators' names and how they want to be credited, then add them.

**Done when:** someone who has never seen the repo can follow `CONTRIBUTING.md`, run the example adapter test, see it fail after editing `expected.json`, and open a correctly filled pull request.

---

## Track C — Engine refactor, shipped as 0.3.0 for UH only (C)

Needs B1 for CI. This is the largest track. Each step below is its own pull request with tests.

### What exists today (from reading the code)
- `src/content.js` (691 lines) mixes UH parsing (selectors from `src/config.js` and `OPEN_SEATS_PATTERN = /Open Seats (\d+) of (\d+)/g`) with rendering, rankings, and lookups.
- **Seat chips only render after a lookup succeeds.** `processInstructorNode` awaits `requestLookup` and only then calls `renderSectionAndBadge` → `renderOverlay` → `createSeatPressureChip`. If CougarGrades or RMP is down, students lose seat notices too.
- `src/background.js` accepts `LOOKUP_PROFESSOR` / `LOOKUP_COURSE` from **any** sender. It doesn't check which page the message came from.
- The options page exposes raw CSS selectors and `universityName` as global settings stored in `storage.sync`. These are really UH-adapter internals.
- Thresholds: `SEAT_PRESSURE_MAX_OPEN = 5`, `SEAT_PRESSURE_MAX_RATIO = 0.1`.

### C1. Define the adapter contract (`src/adapters/contract.md` + JSDoc in `_template.js`)

```js
{
  id: "uh",                         // stable, lowercase, never changes
  displayName: "University of Houston",
  host: "saprd.my.uh.edu",          // exact HTTPS host
  pathPattern: null,                // optional RegExp source for portals sharing a host
  allFrames: false,                 // true if results live inside an iframe
  features: { seats: true, instructors: true, grades: true, ratings: true, rankings: true },
  dataSources: ["cougargrades", "rmp"], // [] for the pilot; background enforces this
  findSections(root) {              // read-only; returns Section[]
    return [{
      anchor,            // Element to attach the overlay to
      courseCode,        // "COSC 1336" or null (unknown)
      instructor,        // "Jane Doe", or null if unassigned
      unassigned,        // boolean
      seats              // { open, total } or null if unknown
    }];
  }
}
```

- [ ] Write the contract with examples. Unknown values are `null`, never guessed.
- [ ] Rules enforced by review and a lint test: adapter files may not reference `fetch`, `XMLHttpRequest`, `chrome.`, `browser.`, `eval`, `Function(`, `import(`, `setInterval`, `localStorage`, or `document.cookie`. A simple text-search test in `test/adapters.test.mjs` is enough.

### C2. Extract the UH adapter (no behavior change)
- [ ] Create `src/adapters/uh.js` holding the selectors, `OPEN_SEATS_PATTERN`, course-header inheritance (`extractRowCourseCode`), and placeholder-instructor detection (`findPlaceholderInstructorNode`), all behind `findSections`.
- [ ] `content.js` becomes the shared engine. It asks the active adapter for sections, then handles claims, lookups, rendering, rankings, and the MutationObserver.
- [ ] Keep the special UH cases: the innermost-span rule, lecture/lab de-duplication via row claims, and course-code inheritance.
- [ ] **Acceptance:**
  - all 31 Node tests and all 25 browser fixture checks pass unchanged;
  - new `test/fixtures/campuses/uh/` synthetic fixtures with expected output pass;
  - a live check of COSC 1336 and MATH 2414 matches the numbers in `RELEASE-CHECK.md` (23 overlays, 10 Best Overall, and so on).

### C3. Shared output checks (show nothing rather than wrong data)
- [ ] In the engine, check every adapter's output before rendering. Drop a section if:
  - `open > total`;
  - either count is negative or not a whole number;
  - `total === 0`;
  - two sections share the same anchor.
- [ ] Page-level check: if the adapter returns zero sections, or more than X% are dropped, render **nothing** on that page and log one console warning tagged `[ProfCheck:<campusId>]`. Suggested X = 50%.
- [ ] Tests: each rule, plus the page-level cutoff.

### C4. Seat notices independent of lookups (milestone 3)
- [ ] Render the overlay host and seat chip as soon as the section is detected, then add rating and grade chips when lookups resolve.
- [ ] One shared seat rule: keep 5 open / 10%. Full (0 open) shows "Full", and waitlisted shows "Waitlist" if the adapter reports it. Add `waitlisted: boolean | null` to the contract.
- [ ] When a refresh changes the counts, the chip updates. When results are replaced, old chips are removed (already handled by `pruneDetachedSections`, but test it again).
- [ ] **Tests (from the original plan):**
  - lookup unavailable → the seat chip still shows;
  - seat count changes after results refresh → the chip updates;
  - full and waitlisted cases.

### C5. Per-campus settings and migration
- [ ] New storage shape in `storage.sync`: `campuses: { uh: { enabled: true } }`. Feature toggles (`showRmp`, `showCougarGrades`, `darkMode`, `defaultScoringMode`) stay global.
- [ ] **Migration** in `onInstalled` with `reason === "update"`, previous version below 0.3.0:
  - if the user changed any selector from its default, keep it as `campuses.uh.selectorOverrides`;
  - if they didn't, drop the keys;
  - `universityName` stays UH-only.
- [ ] Options page: move the selector fields and university name into a collapsed "Advanced (UH)" section. Contributors set their own adapter's selectors in code, not in settings.
- [ ] **Tests:**
  - upgrade from 0.2.0 defaults;
  - upgrade from 0.2.0 with custom selectors;
  - fresh install;
  - settings survive a reload.

### C6. Background gating
- [ ] In `runtime.onMessage`, look up the campus from `sender.url` (or `sender.tab.url` for frames), then:
  - reject lookups when the campus's adapter has no matching `dataSources` entry;
  - reject lookups from unknown hosts;
  - reject when the sender isn't a content script of this extension (`sender.id`).
- [ ] CougarGrades and RMP lookups are only allowed for `uh`.
- [ ] **Test:** a message from a pilot-host sender gets `{ ok: false }` and no network request is made. Assert with the existing fetch stubs in `test/background.test.mjs`.

### C7. Campus switches and permissions (infrastructure only; UH is the only campus in 0.3.0)
- [ ] Manifest: add `"scripting"` to `permissions` and `"optional_host_permissions": []` (empty in 0.3.0). UH keeps its static `content_scripts` and `host_permissions`, so nothing changes for UH users.
- [ ] Options page: add a "Campuses" section. List each registered adapter with a switch, a status label (Supported / Beta / Paused), and its features.
- [ ] Turning on a non-UH campus:
  1. Call `chrome.permissions.request({ origins: ["https://<host>/*"] })` from the click handler (it needs a user gesture).
  2. If granted, call `chrome.scripting.registerContentScripts` with an id like `campus-<id>`, matching that host, using `allFrames` from the adapter and `persistAcrossSessions: true`.
  3. Show "Access granted. Reload your portal tab."
  4. If denied, leave the switch off and show "Access not granted."
- [ ] Turning a campus off: unregister its scripts, call `chrome.permissions.remove`, then show "Reload your portal tab."
- [ ] Turning UH off: the static script reads `campuses.uh.enabled` and exits early.
- [ ] Background `onStartup` and `onInstalled`: reconcile registered scripts with granted permissions and settings, both ways.
- [ ] `permissions.onRemoved` (when the user revokes access in Chrome's own UI): unregister scripts and mark the campus off.
- [ ] One content-script entry point chooses the adapter from `location.host` (and `pathPattern`), so a pilot tab can never use the UH adapter and the reverse.
- [ ] **Firefox:** `manifest.firefox.json` must still build for UH. Add the same keys, and confirm Firefox supports `scripting.registerContentScripts` with `persistAcrossSessions`; if not, gate that code path. Other campuses on Firefox stay deferred.

### C8. 0.3.0 release gates
- [ ] `npm run check` is green, and the browser fixtures pass, including new fixtures for:
  - duplicate rows;
  - unassigned instructors;
  - missing or malformed counts;
  - changing seat counts;
  - results replaced during navigation.
- [ ] **Upgrade test:** install 0.2.0 from the store, or the 0.2.0 ZIP unpacked, change a setting, then load 0.3.0 over it. Confirm:
  - no permission warning and the extension isn't disabled;
  - settings are kept;
  - UH works.

  Also confirm with Chrome's "pack extension" test, or the Web Store's draft preview, that adding `scripting` and empty `optional_host_permissions` causes no warning.
- [ ] Fresh install test. An unrelated website (e.g. wikipedia.org) gets no injected script.
- [ ] Live UH smoke test: COSC 1336 and MATH 2414 match the 0.2.0 numbers. Also kill the network (DevTools offline for api.cougargrades.io) and confirm seat chips still show.
- [ ] Inspect the ZIP: `src/adapters/example.js` and the `test/` folder are **not** included, and the manifest hosts are exactly `api.cougargrades.io` and `saprd.my.uh.edu`.
- [ ] Update `RELEASE-CHECK.md` for 0.3.0, publish, and watch reviews and errors for about a week before shipping 0.4.0.

**Done when:** 0.3.0 is live, UH has had no regressions for a week, and the campus framework is in place with only UH registered.

---

## Track D — Pilot qualification (V, B approving)

Can start today, at the same time as A–C.

- [ ] **D1. Send the volunteer the discovery checklist** for both Lone Star and Texas Tech, to fill out using only their own login:
  - the exact hostname of the course-search page, and whether the URL changes between search and results;
  - whether results are inside an iframe;
  - for each section: is the course code shown? is the instructor shown, and how is "unassigned" written? are open and total seats shown, and in what format?
  - does searching again or paging replace the results without a full page reload?
  - waitlist display;
  - the platform, if they can tell (PeopleSoft, Banner, Workday, Ellucian Colleague, etc.);
  - can a second student at that school test?

  They must not send screenshots unless student details are blacked out. Written answers are preferred.
- [ ] **D2. Volunteer opens campus request issues** for both schools using the form.
- [ ] **D3. Bryan picks the pilot campus.** It needs authorized access, reliable course and seat fields, and two testers. If both qualify, pick the simpler host and layout. Record the decision in brainstorm.md.
- [ ] **D4. Bryan approves on the issue:** the exact host, an optional path, the feature scope (course, instructor, seats), and `dataSources: []`.
- [ ] **D5. Volunteer signs the agreement** (needs A4), forks the repo, and reads `CONTRIBUTING.md` (needs B5).
- [ ] **If neither school qualifies:** keep developing against the example campus (B4) and look for another volunteer through the campus request form.

**Done when:** one campus is approved, with a named maintainer and second tester.

---

## Track E — Pilot campus, shipped as 0.4.0

Needs C (0.3.0 live), D (campus approved), and A (agreement working).

### E1. Volunteer builds the adapter (V)
- [ ] Copy `_template.js` to `src/adapters/<id>.js` and write `findSections`.
- [ ] Hand-build synthetic fixtures for:
  - a normal results page;
  - an unassigned instructor;
  - a full section;
  - a waitlisted section;
  - a page after a re-search.
- [ ] Write `expected.json` for each fixture.
- [ ] Register the adapter in the adapter list, and add `https://<host>/*` to `optional_host_permissions`.
- [ ] Run `npm run check` locally. Load the fork unpacked, switch the campus on, and check the live portal.
- [ ] Open the pull request with the template filled in, and sign the agreement on it.

### E2. Bryan reviews (B, with C helping)
- [ ] The adapter only reads the page. The lint test passes, and you've read every line.
- [ ] Fixtures were built by hand and the scanner passes. Open each one and look.
- [ ] The manifest diff is exactly one new optional host, the approved one.
- [ ] `features` and `dataSources: []` match what was approved.
- [ ] CI is green, and all UH tests still pass.
- [ ] Do **not** merge yet. The live test comes first.

### E3. Live campus testing (V + T, B running UH)
- [ ] Bryan builds a release candidate from the pull request's commit, as a GitHub Release (pre-release) on the main repo with the ZIP and commit ID. Version `0.4.0-rc.N` in the release title, with manifest version `0.4.0`.
- [ ] Each tester loads the ZIP unpacked and files a **Test report** issue covering:
  - search results;
  - a refresh that replaces results;
  - navigating away and back;
  - an unassigned instructor;
  - a full or waitlisted section;
  - switching the campus off and reloading (no overlays);
  - denying access when switching on (the campus stays off).
- [ ] Bryan, on the same release candidate:
  - runs the UH smoke test;
  - opens a UH tab and a pilot tab at the same time and confirms each uses its own adapter;
  - confirms in DevTools → Network that **zero** requests are sent from the pilot tab;
  - runs the upgrade test from 0.3.0.
- [ ] Any failure → fix in the pull request → new release candidate → testers test again. You need **two passing reports on the same release candidate.**

### E4. Privacy and listing (B, with C drafting)
- [ ] `pages/privacy.html` and `docs/PRIVACY.md` get a per-campus table: UH sends course codes and instructor names to CougarGrades; `<pilot>` reads the course-search page in your browser and sends nothing.
- [ ] Update the hosted privacy policy URL to match.
- [ ] Chrome Web Store dashboard, Privacy tab:
  - "Website content" stays ticked;
  - the single-purpose description says "course search on supported university enrollment portals";
  - the permission justifications cover `scripting` and the optional host access.
- [ ] Listing description adds "Beta support for `<campus>`". The name stays "UH ProfCheck".
- [ ] `manifest.json` `description` stays within 132 characters (`package-release.py` checks this).
- [ ] Update `CAMPUSES.md`: the pilot campus with status Beta, the maintainer handle (with consent), and supported features.

### E5. Release (B)
- [ ] Merge the pull request, using the exact commit that was tested. If anything changed after testing, testing starts again.
- [ ] Release notes include:
  - the version;
  - the adapter commit;
  - the campus and its supported features;
  - credit to the maintainer and tester (with consent).
- [ ] Run `npm run check`, then `npm run package`. Inspect the ZIP: one new optional host, and no `test/` or `example.js`.
- [ ] Update `RELEASE-CHECK.md` for 0.4.0.
- [ ] Upload to the Chrome Web Store and submit. While review takes days, do nothing to the release.
- [ ] Once it's live: install from the store on a clean Chrome profile, switch on the pilot campus, and have the maintainer confirm it works from the store build.

### E6. Announce and close out (B)
- [ ] Tell the volunteer and testers. Post in the original Reddit thread if appropriate.
- [ ] Update brainstorm.md: mark the pilot done, record the lessons, and schedule the rebrand decision before a second outside campus ships.
- [ ] Reply on the second school's request issue with next steps, using the same flow.

**Done = LAUNCH.**

---

## After launch: keeping it working

- **Broken campus:** someone opens a `campus-broken` issue, and Bryan labels it and records the date. The maintainer reproduces the problem with a new synthetic fixture → fix pull request → one passing test report → patch release. **14 days** with no fix or no tester → ship a patch that marks the campus "Paused" (off by default, and users can switch it back on). Update `CAMPUSES.md`.
- **The output checks protect students meanwhile.** A badly broken layout usually triggers C3 and shows nothing instead of wrong seat counts.
- **Every release** runs the UH smoke test and at least one maintainer test report for each live campus that the release touches.
- **Before a second outside campus:** decide the rebrand (name conflict noted in brainstorm.md), and move the website and campus data sources from open questions to decisions.

---

## Risks to watch

| Risk | What happens | Mitigation |
|---|---|---|
| Upgrade causes a permission warning | Chrome disables the extension for every UH user | C8 upgrade test before 0.3.0 ships. Keep the UH host static, and keep `optional_host_permissions` empty in 0.3.0 |
| Engine refactor breaks UH | Current users lose features | Separate 0.3.0 release. Synthetic UH fixtures plus live numbers from RELEASE-CHECK.md |
| Store rejects for scope or single purpose | Release delayed | Clear permission justifications; per-campus privacy table; the pilot sends no data |
| Volunteer goes quiet | Pilot stalls | Example campus keeps development moving; campus request form finds others; 14-day rule after launch |
| Real student data lands in the repo | Privacy incident, public in git history | Scanner in CI, by-hand fixture rule, Bryan opens every fixture. If it happens: rewrite history and force-push, ask GitHub support to purge cached views, tell the person |
| chaseum won't sign | Can't relicense or sell their code | Make a list of their files now; rewrite only if needed |
| Pilot portal needs iframes or shares a host | Adapter can't target the page | `allFrames` and `pathPattern` in the contract (C1) |

---

## Rough effort

| Track | Effort | Can start |
|---|---|---|
| 0 | An hour | Now |
| A | A few hours of Bryan's time plus waiting on the clinic (1–3 weeks) | Now |
| B | 2–3 working sessions | Now |
| C | The largest: about 5–8 working sessions, then about a week watching 0.3.0 | After B1 |
| D | Depends on the volunteer; aim for 1–2 weeks | Now |
| E | 2–4 sessions plus test rounds plus store review (days) | After A, C, D |

Critical path: **B1 → C → 0.3.0 live + a week → E → store review.** Tracks A and D just need to finish before E starts.
