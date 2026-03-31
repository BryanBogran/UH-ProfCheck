Project context for Codex

Repo name:
Professor Overlay / UH-ProfCheck

What this project is:
This repo is a small Chrome extension built with Manifest V3. It enhances the University of Houston enrollment portal at:
https://saprd.my.uh.edu/*

The extension injects inline chips next to professor names and course headers on the UH enrollment/class selection pages. Those chips link to:

- RateMyProfessor
- CougarGrades

For CougarGrades, the chips may also show data badges such as:

- GPA
- withdrawal/drop rate

The repo is intentionally simple:

- no framework
- no build step
- plain static extension code

Current file structure:

- manifest.json
  - MV3 config
  - registers one content script
  - registers one background service worker
  - registers an options page
- src/content.js
  - scans the enrollment page DOM
  - finds instructor and course-code elements via configurable selectors
  - injects overlay chips inline beside detected nodes
- src/background.js
  - handles cross-origin fetches to CougarGrades API
  - merges/normalizes CougarGrades + RateMyProfessor search results
  - caches lookups in memory
- options/options.\*
  - settings UI stored in chrome.storage.sync
  - allows URL patterns, DOM selectors, and toggles to be configured
- PRIVACY.md / privacy.html
  - privacy policy for Chrome Web Store use

Current runtime flow:

1. Content script runs on UH enrollment pages.
2. It watches the DOM with a MutationObserver because the portal likely re-renders dynamically.
3. It extracts professor names and course codes from the page.
4. It sends LOOKUP_PROFESSOR messages to the background worker.
5. The background worker calls CougarGrades API endpoints:
   - /api/external/rmp/search
   - /api/instructor/{lastFirstName}
6. The content script renders inline badge/chip links beside the detected nodes.

Important implementation details:

- Default selectors are UH/PeopleSoft-oriented.
- Instructor selector is especially based on:
  span[id*='SSR_INSTR_LONG']
- Course code selector is especially based on:
  span[id*='SSS_SUBJ_CATLG']
- The extension is intentionally scoped to UH enrollment pages, not all websites.
- Config is user-editable from the options page.
- Professor names are normalized.
- Course codes are regex-extracted.
- Duplicate rendering is avoided with WeakSets.
- Duplicate network lookups are reduced with pending in-page lookup maps plus a background cache.
- Links open in new tabs with noopener,noreferrer.

Current caveats / technical debt:

- The extension depends heavily on the live enrollment page DOM structure.
- Selector accuracy is the biggest maintenance risk.
- It relies on CougarGrades as the bridge for RateMyProfessor data rather than scraping RMP directly.
- Background cache is memory-only and resets when the service worker restarts.
- Content script currently caches by professor name only, even though course code is also available.
- That means one professor’s lookup may be reused across different rows/sections.

Product goal:
Build the best lightweight UH registration assistant for picking classes.
The extension should help students evaluate professors and sections directly inside the UH registration portal without bloating into an unrelated all-purpose planner.

Core value proposition:

- show professor quality inline during registration
- reduce tab switching
- make section comparison easier
- help users choose better sections faster
- eventually help users build a conflict-aware draft schedule from selected sections

What we already discussed as good feature ideas:

1. Expandable professor summary
   - small popover/card when clicking a chip
   - show overall rating, difficulty, would-take-again, GPA, withdrawal rate
   - optionally summarize review themes in a very short format such as:
     - clear lectures
     - hard exams
     - attendance matters

2. Best Pick / recommended professor
   - for sections of the same course, highlight a recommended option
   - score can consider:
     - RMP rating
     - GPA
     - withdrawal rate
     - confidence / rating count
   - provide ranking modes such as:
     - Balanced
     - Easiest A
     - Best teaching
     - Lowest risk

3. Compare sections
   - compare all sections for the same course in one UI
   - columns may include:
     - instructor
     - RMP
     - GPA
     - W rate
     - seats open
     - meeting times
     - weighted score

4. Shortlist
   - let users star or save sections they are considering
   - shortlist can live in a compact overlay, popup, or side panel

5. Confidence indicators
   - show simple quality flags such as:
     - Low review count
     - No recent data
     - Multiple instructor match
     - CougarGrades only
     - TBA time

New feature ideas the user specifically wants implemented:

1. Auto-draft schedule
   - generate the best non-conflicting combination of sections from the user’s selected/shortlisted/carted classes
   - take into account professor quality and schedule conflicts
   - example preference:
     "maybe taking 2 B-level professors is still the best option if that creates the strongest overall schedule"
   - this means the schedule optimizer should support tradeoffs instead of only picking the top-rated professor per course

2. Shopping cart integration
   - integrate with the UH shopping cart flow if feasible from the page DOM
   - detect whether a section is already in the cart
   - ideally allow users to move from recommendation -> compare -> shortlist -> cart
   - cart state should be visible in the extension UI

Highest-priority feature roadmap we agreed makes the most sense:
Tier 1:

- shopping cart integration
- compare selected sections
- shortlist / planner tray or side panel

Tier 2:

- auto-draft schedule with conflict detection
- recommendation modes and weighted scoring

Tier 3:

- professor summary popover
- backup schedule suggestions
- confidence/data quality badges

Important product constraint:
Do not turn this into a giant generic college planner.
Keep it tightly focused on one workflow:
UH registration enhancement

Target product story:
"UH registration assistant that shows professor ratings and CougarGrades data, compares sections, helps build a conflict-free draft schedule, and integrates with the shopping cart."

UI direction:
Current UI is working but basic. We want cleaner, more polished UX before Chrome Web Store launch.

Desired UI improvements:

- keep row-level chips compact
- reveal more detail on click/hover instead of always showing too much
- use subtle colors and avoid cluttering the registration page
- show a compact one-line score summary when possible
- support a stronger comparison view
- likely introduce a persistent side panel or planner tray for shortlist/cart/schedule drafting
- keep the options page simple for normal users and move advanced selector controls into an "Advanced" section

Suggested UX structure:
A. Inline row chips

- RMP chip
- CougarGrades chip(s)
- optional "Best Pick" tag
- optional "In Cart" or "Saved" state

B. Compare / summary popover

- open from a chip or course header
- show per-section metrics in a compact card

C. Persistent planner UI

- shortlist
- selected sections
- cart state
- generated draft schedule
- alternate schedule options

Technical direction for new features:

1. Better data model
   Create normalized objects for:

- professor
- section
- course group
- shortlist item
- cart item
- generated schedule candidate

Suggested section shape:
{
sectionId,
classNumber,
courseCode,
title,
instructorName,
normalizedInstructorName,
meetingDays,
startTime,
endTime,
location,
seatsOpen,
inCart,
rmp: {
rating,
difficulty,
wouldTakeAgain,
numRatings,
url
},
cougarGrades: {
averageGpa,
withdrawalRate,
url
},
confidence: {
matchedInstructor: true,
lowReviewCount: false,
missingTime: false
},
score: {
balanced,
easiestA,
bestTeaching,
lowestRisk
}
}

2. Scoring system
   Implement weighted scoring profiles:

- Balanced
- Easiest A
- Best Teaching
- Lowest Risk

Example factors:

- RMP rating
- RMP difficulty
- number of ratings / confidence
- CougarGrades GPA
- withdrawal rate
- seats open
- recentness / completeness of data

Scores should be transparent and easy to tweak.

3. Schedule drafting
   Build a schedule generator that:

- groups sections by course
- generates non-conflicting combinations
- removes combinations with overlapping times
- handles TBA sections carefully
- ranks valid schedules by selected weighting mode

Support user tradeoffs, such as:

- accept a slightly weaker professor if the overall schedule is better
- allow the optimizer to choose the best full combination rather than the best individual row

4. Cart awareness
   If possible, detect from DOM whether a section is already in the UH shopping cart.
   Potential features:

- "Already in cart" badge
- "Compare with carted sections"
- "Generate best schedule from cart"
- "Save recommended schedule to cart" if DOM interaction is safe and reliable

5. Caching improvements
   Move away from professor-name-only caching.
   Cache should ideally consider:

- professor name
- course code
- maybe term if needed

Use:

- chrome.storage.sync only for lightweight user settings
- chrome.storage.local or session-like storage for cached lookup data if needed
- in-memory caches can still exist for speed, but should not be the only layer

6. DOM scanning improvements
   Because the UH portal is dynamic:

- keep MutationObserver
- debounce scans
- avoid rescanning the entire page when possible
- scope scans to known enrollment containers
- avoid duplicate injections
- handle rerenders safely

7. Settings UI direction
   Make the options page friendlier.
   Split into:

- Basic settings
- Advanced settings

Basic settings:

- Show RateMyProfessor chips
- Show CougarGrades chips
- Show Best Pick tag
- Default ranking mode
- Enable shortlist / planner tray
- Enable schedule drafting
- Enable cart integration

Advanced settings:

- URL patterns
- DOM selectors
- debug options
- force rescan
- clear cache

8. Error/empty states
   Need explicit handling for:

- no instructor detected
- no course code detected
- no CougarGrades match
- no RMP match
- ambiguous instructor match
- no meeting time / TBA
- service worker/API failure
- no non-conflicting schedule found

9. Web Store readiness
   This should feel polished, narrow, and trustworthy.
   We want:

- one clear purpose
- minimal permissions
- clear privacy explanation
- screenshots that show the value immediately
- strong onboarding and store copy

Design principles:

- practical, compact, fast
- no visual spam
- no scraping outside the intended workflow
- no unrelated features
- no overengineering
- preserve the existing no-build-step approach unless absolutely necessary

Constraints:

- development is limited
- this was initially vibe-coded and needs hardening
- prioritize highest-ROI features first
- prefer features that are realistic to ship and maintain
- maintain compatibility with the current simple repo architecture when possible

What Codex should help with:

- propose architecture changes without introducing unnecessary framework complexity
- write clean MV3-compatible code
- preserve existing repo simplicity
- implement features incrementally
- avoid breaking the current working overlay
- favor small, testable additions
- suggest safe DOM integration patterns for PeopleSoft-style pages
- improve UX without overloading the page

Immediate implementation priority:

1. compare selected sections
2. shortlist / planner tray or side panel
3. shopping cart awareness/integration
4. scoring profiles
5. auto-draft schedule generator
6. professor summary popover
7. reliability/performance polish

What not to build right now:

- generic multi-school support
- massive calendar/planner app
- unrelated GPA calculator features
- long AI-generated review essays
- bloated UI that overwhelms the registration page

Ask from Codex:
Given the current repo structure and constraints, propose the cleanest incremental implementation plan and then implement the next best version of this extension starting with:

- a normalized section data model
- compare selected sections
- shortlist storage/UI
- shopping cart awareness
- scoring modes
- schedule drafting engine
  while keeping the extension simple, maintainable, and Chrome Web Store-ready.
