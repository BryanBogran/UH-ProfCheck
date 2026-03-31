# UH ProfCheck

UH ProfCheck is a Manifest V3 browser extension for the University of Houston enrollment portal. It enhances the in-page registration experience by attaching professor and course context directly to AccessUH search results using CougarGrades and RateMyProfessor data.

Version: `0.2.0`

## Overview

UH ProfCheck runs on `https://saprd.my.uh.edu/*` and adds lightweight overlays next to instructor and course nodes on the registration page. Instead of forcing students to open multiple tabs for each section, it surfaces the most useful signals inline:

- RateMyProfessor rating links
- CougarGrades GPA links
- CougarGrades drop-rate links
- Course-level CougarGrades links for detected course headers
- Fallback course stats when the instructor is `TBA`, `Staff`, or `To Be Announced`

The extension is scoped to UH enrollment pages and fetches data through the CougarGrades API bridge.

## Completed V2 Features

- Refreshed V2 settings page with grouped controls and a cleaner layout
- Browser-compatible storage access via `browser ?? chrome`
- Toggleable RateMyProfessor overlays
- Toggleable CougarGrades overlays
- Default scoring mode selector with:
  `Best Overall`, `Easiest A`, and `Lowest Risk`
- Full-page optional dark mode for the AccessUH enrollment UI
- Smarter in-page rescanning with mutation observation plus delayed rescans after load
- Improved overlay layout that stacks cleanly around professor names instead of breaking row clicks
- Dedicated CougarGrades course links for detected course header nodes
- Placeholder instructor support for `TBA`, `Staff`, and `To Be Announced`
- Placeholder fallback chips that show course GPA and course drop rate when instructor data is unavailable
- Legacy overlay cleanup so older chip formats do not accumulate after rerenders
- Background-side request caching for professor lookups and course lookups
- Settings actions to clear cached API data
- Settings action to clear local planner-related data
- Selector helper script for discovering likely instructor nodes from the live UH page
- Support, feedback, and rate pages for extension users
- Firefox-specific MV3 manifest for testing and packaging outside Chromium

## Current Data Sources

- CougarGrades instructor lookup:
  `https://api.cougargrades.io/api/instructor/{name}`
- CougarGrades course lookup:
  `https://api.cougargrades.io/api/course/{courseCode}`
- CougarGrades RateMyProfessor bridge:
  `https://api.cougargrades.io/api/external/rmp/search`

## What The Extension Shows

For instructor rows with matched data, UH ProfCheck can render:

- A scoring chip based on the selected default mode
- `Rating X.X` from RateMyProfessor
- `GPA X.X` from CougarGrades
- `Drop Rate X.X%` from CougarGrades

For rows without an assigned instructor, UH ProfCheck can render:

- `Instructor TBA`
- `Course GPA X.X`
- `Course Drop Rate X.X%`

For top-level course headers, UH ProfCheck can also render:

- `Course stats for SUBJECT ####`

## Project Structure

- `manifest.json`
  Chromium manifest for Chrome and Brave.
- `manifest.firefox.json`
  Firefox MV3 manifest with the alternate background declaration Firefox expects.
- `src/content.js`
  Detects course and instructor nodes, injects overlays, handles placeholder rows, and applies optional dark mode.
- `src/background.js`
  Handles cross-origin API requests, normalizes CougarGrades and RateMyProfessor responses, and caches lookup results.
- `src/content.css`
  Styles the overlay system and AccessUH dark mode.
- `options/options.html`
  V2 settings UI.
- `options/options.js`
  Saves config, restores defaults, copies the selector probe, clears local planner data, and clears lookup cache.
- `pages/support.html`
  Support/contact page.
- `pages/feedback.html`
  Feedback page.
- `pages/rate.html`
  Browser-store review page.
- `PRIVACY.md`
  Markdown privacy policy.
- `privacy.html`
  Hosted/privacy-page version of the policy.

## Installation

### Chrome or Brave

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this project folder.

### Firefox

Firefox still expects a different MV3 background declaration than Chromium, so use the Firefox manifest in a separate build folder.

1. Copy `manifest.firefox.json` over `manifest.json` in a Firefox-only build folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on`.
4. Select that build folder’s `manifest.json`.

## Default Configuration

The shipped defaults are aimed at UH:

- University name:
  `University of Houston`
- Enabled URL pattern:
  `https://saprd.my.uh.edu/*`
- Course row selector:
  `[data-course-row], tr, .course-row, .class-row`
- Instructor selector:
  `span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name`
- Course code selector:
  `span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog`

## Settings

The V2 settings page includes these user-facing controls:

- Show RateMyProfessor data
- Show CougarGrades data
- Enable planner tray overlay
- Show confidence warnings
- Use dark mode for the full AccessUH enrollment page
- Choose the default scoring mode

Note: the planner/confidence controls are present in settings and stored in config, but the checked-in `0.2.0` implementation is still primarily centered on overlays, lookups, theming, support pages, and cache/data-management actions.

## Selector Helper

The settings page includes a probe script you can paste into DevTools Console while viewing the live enrollment portal. It finds likely instructor-name nodes and prints candidate selectors with row context. This is useful when UH changes markup or when adapting the extension to a similar page layout.

## Privacy Summary

- The extension only runs on `https://saprd.my.uh.edu/*`
- It reads professor names and course codes from the current UH enrollment page
- It stores user configuration in sync storage
- It can clear local planner-related data from local storage
- It does not include analytics or developer telemetry
- Its external network requests are limited to CougarGrades API endpoints

See [PRIVACY.md](/Users/chase/code/chrome-extension/PRIVACY.md) for the full markdown policy and [privacy.html](/Users/chase/code/chrome-extension/privacy.html) for the hosted-page version.

## Changelog

### `0.2.0` - V2 release

- Repositioned the project from a starter overlay into a UH-specific extension
- Updated the extension name and manifest description to `UH ProfCheck`
- Restricted content-script matching to `https://saprd.my.uh.edu/*`
- Added a Firefox-specific manifest for cross-browser testing
- Rebuilt the options page into a fuller V2 settings experience
- Added default scoring mode settings for `Best Overall`, `Easiest A`, and `Lowest Risk`
- Added full-page AccessUH dark mode support
- Added support, feedback, and rate pages
- Added settings actions for clearing local planner data and API cache
- Added background message handling for `LOOKUP_COURSE` and `CLEAR_CACHE`
- Added CougarGrades course lookup support in the background worker
- Expanded CougarGrades normalization to include GPA, drop rate, instructor/course counts, seasonal metadata, and recent sections
- Added placeholder instructor handling for `TBA`, `Staff`, and `To Be Announced`
- Added course-stat fallback chips for unassigned instructors
- Reworked overlay rendering to support stacked layouts and safer click handling inside PeopleSoft rows
- Added cleanup logic for legacy chip formats after rerenders
- Added delayed rescans and mutation-based rescans to survive dynamic page updates
- Added support for optional full-page dark overlay styling in `content.css`
- Added browser-agnostic extension API access using `globalThis.browser ?? globalThis.chrome`

### `0.1.0`

- Initial overlay implementation
- Basic RateMyProfessor lookup support
- Basic CougarGrades instructor lookup support
- Starter options page for selectors and URL patterns

## Known Scope

This README documents shipped behavior in the current codebase. Some V2 wording in the manifest and settings refers to planner, compare, shortlist, and confidence concepts, but those flows are not yet fully represented in the checked-in runtime code.
