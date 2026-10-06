# UH ProfCheck 0.2.0 release check

Reviewed October 6, 2026 in `Documents/UH ProfCheck/UH ProfCheck V2`, branch `v2`.

The local Chrome release passes the checks below. No unresolved release-blocking code issue was found in the tested paths. Update or verify the hosted privacy policy before submitting. This review covers Chrome; Firefox has not been tested in a real Firefox browser.

## Fixes made during review

- Page updates now replace stale instructor metrics, course links, recommendations, and seat notices. Removed rivals no longer leave a best-of-one badge.
- Rows inherit the appropriate course header when UH does not repeat a course code in every row. Unknown-course rows are not grouped into misleading recommendations.
- Data-source changes remove disabled data and fetch newly enabled sources immediately. Cache keys distinguish sources, university, strict search, and configured service URLs; cached results preserve the current requested course code.
- An RMP candidate from a different university is no longer used as a fallback. Partial API failures preserve the source that succeeded; requests time out after 15 seconds.
- Names support accented letters and curly apostrophes, preserve surnames containing placeholder words, and remove parenthetical roles. Compact course codes are normalized consistently.
- Changed instructors release old row claims. A shared row remains highlighted when any of its instructors wins, and disabling rankings clears that highlight.
- Launcher startup handles concurrent preference changes. Keyboard activation enters ranking controls; Escape closes and returns focus. Invalid saved positions and interrupted drags are handled safely. Ranking-save failures show a status message.
- Options report save and cache-clear failures accurately. Manifest descriptions and feature/privacy documentation now match the implemented behavior.

## Validation

| Check | Result |
| --- | --- |
| Node tests: background lookup/caching, parsing, scoring, theme preference/races | 31 passed, 0 failed |
| Real extension scripts in Chrome with deterministic enrollment/API fixtures | 25 passed, 0 failed |
| Runtime JavaScript syntax | 9 files passed |
| Git whitespace/error check | Passed |
| Chrome manifest, runtime resources, and local HTML links | Passed |
| Upload ZIP root manifest and integrity | Passed |

The browser fixtures exercise dynamic instructor changes, independent course groups, TBA fallback, shared rows, ranking modes, source toggles, invalid selectors, low-seat updates, click propagation, keyboard semantics, theme changes, and API failure behavior. They use local API doubles and do not constitute live server tests.

Manual installed-extension checks on the authenticated UH portal confirmed:

- COSC 1336 displays real RMP, GPA, and withdrawal links for Jaspal Subhlok, with no best-of-one recommendation.
- MATH 2414 displays 23 section overlays without duplicate lecture/lab chips and shows Best Overall/Top Pick recommendations. All three ranking controls update the displayed recommendations.
- Dark mode switches immediately and survives course navigation. Space opens the launcher and focuses the controls; Escape closes it and returns focus.
- The launcher image is loaded at its expected 32-pixel size. No ProfCheck errors were present in captured page console logs.

Local manual checks also confirmed dark-mode propagation into a dialog iframe, settings validation/save, and preference persistence after reloading the settings page. API-cache clearing was checked through the options UI and independently against the real background handler in automated tests.

After the final code changes, the user reloaded the extension again. A fresh portal navigation to Spring 2027 MATH 2414 confirmed 23 overlays, 23 rating chips, 10 Best Overall recommendations, one launcher, and saved dark mode. Space opened the controls and moved keyboard focus into the panel; Escape closed it and restored focus. The shared-row/claim edge cases were verified in the browser fixture. The browser tool cannot inspect Chrome's extension management page, so the installed folder/version was not independently verified there. Dark mode and Best Overall were restored to the original live preferences. No enrollment, cart, drop, or swap action was submitted.

## Upload artifact

`dist/UH-ProfCheck-0.2.0-chrome.zip`

- Version: **0.2.0**
- 23 runtime files; 72,914 bytes
- SHA-256: `96af6bee922bc013236c517ebb8fe62bfad0e874869037a1c4d2644f4b434f64`
- Includes the Chrome manifest, runtime scripts/styles, icons, settings, and support/privacy pages.
- Excludes Git files, tests, local previews, marketing assets, and the Firefox manifest.

Rebuild after any subsequent runtime edits using `python3 scripts/package-release.py`.

The [published listing](https://chromewebstore.google.com/detail/uh-profcheck/cgddcdnkcckjknijkaopgmhahbcdjjai) showed version 0.1.1 during review. Version 0.2.0 is higher, as required by [Chrome's upload instructions](https://developer.chrome.com/docs/webstore/prepare).

## Before submission

Make the hosted privacy policy linked from the store agree with `docs/PRIVACY.md` and `pages/privacy.html`. They now disclose course-code API requests, seat availability read locally, sync preferences, local launcher position, and session caching. The hosted policy URL could not be retrieved by the web tool, so its current contents were not verified. Chrome requires a current, accurate policy in its [privacy rules](https://developer.chrome.com/docs/webstore/program-policies/privacy).

The release review did not publish or upload the extension to a store. Chrome Web Store acceptance remains subject to its review process.

## Evidence

Local review captures are kept in the ignored `.preview/` folder; they are not included in Git or the upload ZIP:

- `.preview/release-live-reloaded.png`: live UH course page after final reload.
- `.preview/release-regressions.png`: passing browser regression checks.
