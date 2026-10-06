# UH ProfCheck

Version `0.2.0` · Manifest V3 · University of Houston enrollment extension.

UH ProfCheck adds professor ratings, CougarGrades GPA and withdrawal history, section recommendations, and optional dark mode directly to `https://saprd.my.uh.edu/*`.

## Features

- RateMyProfessors rating links and rating-count tooltips, using the CougarGrades RMP bridge and matching the configured university.
- CougarGrades instructor GPA and withdrawal history, plus course-header links.
- Course-wide statistics for TBA, Staff, and To Be Announced instructors when a course is identified.
- Best Overall, Easiest A, and Lowest Risk ranking modes, controlled on the page or in settings.
- Distinct recommendations and shared Top Pick badges for close results. Insufficient data and unknown-course rows are not ranked.
- Low-seat notices using availability currently displayed by myUH.
- Saved, optional dark mode across matching pages and dialog frames; print styles remain light.
- A draggable floating control, with keyboard access and Escape to close.
- Dynamic rescanning for page updates, changed instructor names, and course headers, without duplicate overlays.
- Preferences, advanced selector validation, Clear API Cache, support, feedback, and store-review links.

Compare trays, shortlist/planner trays, and confidence-warning controls are not implemented or advertised in this release.

## Install locally

Open `chrome://extensions`, enable Developer Mode, choose Load unpacked, and select this folder. Reload the extension after editing source, then navigate to a fresh myUH page. A PeopleSoft transaction URL can produce a portal error if reloaded; use the portal Home tile navigation to reopen Manage Classes in that case.

Firefox uses `manifest.firefox.json` copied over `manifest.json` in a separate build folder. Chrome is the publishing target of the current release review; Firefox needs its own real-browser test before publishing there.

## Run checks

```sh
node --test test/*.test.mjs
python3 -m http.server 8791 --bind 127.0.0.1
```

Open `http://127.0.0.1:8791/test/fixtures/release-check.html` for browser regressions against deterministic sample data using the real extension scripts. Open `test/fixtures/theme-preview.html` through the same server for manual dark-mode, settings, keyboard, refreshed-results, and dialog checks. These fixtures use local test doubles and do not contact student accounts or external data services.

## Build the Chrome upload

```sh
python3 scripts/package-release.py
```

The validated ZIP is `dist/UH-ProfCheck-0.2.0-chrome.zip`. It includes only the root Chrome manifest, runtime scripts/styles, icons, options, and support pages. Tests, Git files, previews, marketing assets, and the Firefox manifest are excluded.

Chrome requires the manifest at the ZIP root and a version higher than the previous published version: https://developer.chrome.com/docs/webstore/prepare

## Source

- `src/background.js`: API lookup, source isolation, request timeout, and session caching.
- `src/content.js`: DOM detection, overlays, course grouping, recommendations, availability notices, and updates.
- `src/parse.js` and `src/scoring.js`: parsing and ranking math.
- `src/theme.js` and `src/dark.css`: saved enrollment appearance, independent of data lookups.
- `src/launcher.js` and `src/content.css`: floating controls and overlay styling.
- `options/`: preferences and cache clearing.
- `pages/`: support, feedback, store reviews, and privacy.

Only the `storage` permission and CougarGrades API host permission are requested. See [the privacy policy](PRIVACY.md) and [the in-extension privacy page](../pages/privacy.html) for the data handling disclosure. Update the hosted policy linked in the store before publishing this release.
