Yes. Based on the current extension shape, most of the roadmap is feasible without introducing a framework, but not all at the same risk level.

Most Feasible Now

Normalized section data model
This is the right first step. The current code already extracts instructor and course code in src/content.js and fetches professor data in src/background.js. What’s missing is a per-row section object built from the DOM and passed through the UI layer.
Compare selected sections
Feasible and high ROI. Once each row becomes a normalized section object, you can group by courseCode and render a lightweight compare tray or panel. This fits the current architecture well.
Shortlist storage/UI
Very feasible. Use chrome.storage.local for shortlist state and a small persistent planner tray injected by the content script. This is a straightforward extension of the current overlay model.
Scoring modes
Feasible. Add pure scoring utilities that consume normalized section objects and derive balanced, easiestA, bestTeaching, and lowestRisk scores. This belongs in a separate utility module and does not require risky DOM work.
Professor summary popover
Feasible. The current chips can become buttons that open a compact details card with the already-fetched data plus confidence notes.
Feasible, But Depends On UH DOM Quality

Shopping cart awareness
Read-only cart awareness is likely feasible if the PeopleSoft DOM exposes cart labels, icons, buttons, or section state consistently. Detecting “already in cart” is much safer than trying to click cart actions automatically.
Schedule drafting engine
The algorithm itself is feasible. The real dependency is whether meeting days/times, section IDs, and class numbers can be extracted reliably from the UH page. If those values are present and stable, schedule generation is realistic.
Best Pick / recommended professor
Feasible once section extraction and scoring exist. It becomes a presentation layer on top of scores rather than a separate system.
Confidence indicators
Feasible and recommended. You already have enough signals for low review count, missing match, or missing course/time data.
Possible, But Riskier

Write to shopping cart automatically
This is the part I would not prioritize yet. Reading cart state is one thing; driving PeopleSoft actions through DOM simulation is brittle, likely to break on rerenders, and harder to keep Chrome Web Store-friendly.
Generate best schedule from carted classes only
Feasible if cart awareness is solved, but it should come after the generic schedule engine because it is just a filtered input set.
Review theme summaries
Only feasible if you have a reliable source for short review text themes. The current API usage does not provide that in src/background.js, so this would require a new data source or be dropped.
Not Worth Building Yet

Generic multi-school support
Heavy planner/calendar app behavior
Any feature that requires broad new permissions or aggressive automation on the UH portal
Best Incremental Plan

Build a normalized section extractor in the content script.
Add chrome.storage.local state for shortlist and cached section data.
Add scoring utilities and confidence flags.
Add a compact planner tray for shortlist + compare.
Add schedule conflict detection and schedule ranking.
Add read-only cart detection.
Only after that, decide whether cart write actions are stable enough to support.
What I’d push back on

The current ask bundles too much into one jump. The repo is still thin and DOM-dependent. If you try to add shortlist, compare, cart, scoring, and schedule drafting all at once, you’ll get fragile code fast. The clean move is:

first, normalize the row data model
second, build shortlist/compare UI
third, add scoring and schedule generation
fourth, layer cart awareness on top
