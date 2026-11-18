# UH ProfCheck 0.3.0 release check

Reviewed November 17, 2026 on branch `v2`, commit `814c427`. The previous release, 0.2.0, is live on the Chrome Web Store.

0.3.0 adds the groundwork for other campuses. UH is the only campus in this release, and no new data is sent anywhere.

## What changed since 0.2.0

**Visible to students**
- Seat notices render from the page right away, before rating and grade lookups finish, and also when those lookups fail.
- 0 open seats reads "Full". Waitlisted sections read "Waitlist" when the page says so.
- When no RMP rating can be shown (no match, or the service can't be reached), a "Search RMP" link opens RateMyProfessors' UH search (school 1109) for that instructor. It sends nothing until clicked.
- A failed CougarGrades request reads "CG unavailable" instead of "No CG Data".
- "Instructor TBA" also shows after a failed course lookup.
- Settings has a Campuses section (UH on by default), an "Advanced (UH)" section holding the selector fields, and a "Founded by Bryan Bogran" footer.
- Switching UH off removes overlays, the launcher, and lookups.

**Behind the scenes**
- UH parsing moved into `src/adapters/uh.js`, behind the adapter contract in `src/adapters/contract.md`.
- The engine drops impossible adapter output: open seats greater than total, duplicates, or bad counts. It shows nothing on a page where more than half the sections fail these checks.
- The background script only runs lookups for an enabled campus that is approved for that data source, and only from this extension's own content scripts.
- Campus switches can request optional host access and register content scripts at runtime. This isn't used yet, because UH is static.
- Offline, blocked, and timed-out lookups are logged at info level instead of appearing in the `chrome://extensions` Errors list.

## Validation

| Check | Result |
| --- | --- |
| `npm run check`: Node tests, headless-Chrome engine/regression pages, fixture scan, manifest check | 77 passed, 0 failed, 0 skipped |
| Original 25 browser regression checks (`release-check.html`) | Passed unchanged after the refactor |
| Live UH portal, installed unpacked | COSC 1336 and MATH 2414 behave as in 0.2.0. MATH 2414 shows 23 overlays and 10 Best Overall, and ranking modes switch |
| Live UH portal with `api.cougargrades.io` blocked | Seat chips still render; "Search RMP" and "CG unavailable" shown; no entries in the Errors list |
| Switch UH off, then on | Overlays and launcher removed, then restored |
| Unrelated website | Nothing injected |
| Upgrade from real 0.2.0 (built from commit `4a693aa`) to 0.3.0, unpacked in the same folder | Not disabled, and settings kept |

**Permissions:** 0.3.0 adds `scripting` and an empty `optional_host_permissions`. Neither carries a Chrome permission warning, so store users shouldn't see a prompt or have the extension disabled on update. Reloading an unpacked extension can't fully simulate the store's update prompt, so watch the dashboard and early reviews after publishing.

## Upload artifact

`dist/UH-ProfCheck-0.3.0-chrome.zip`

- Version: **0.3.0**
- 27 runtime files; 83,105 bytes
- SHA-256: `25065793bf680eeab938995b2678a07d7942d7598fb389e1083c294c6fb8e974`
- Manifest: permissions `storage`, `scripting`; host permission `https://api.cougargrades.io/*`; content scripts on `https://saprd.my.uh.edu/*`; `optional_host_permissions: []`. The description is 112 characters.
- Excludes tests, fixtures, `src/adapters/_template.js`, `src/adapters/example.js`, Git files, store assets, and the Firefox manifest.

Rebuild after any runtime edit with `npm run package`.

## Store submission

**Permission justification for `scripting`:**
> Starts ProfCheck on additional university enrollment portals only after the user turns that campus on in settings and grants access to that portal. No campus other than the University of Houston is included in this version.

**Release notes (store "What's new" or support page):**
> Seat notices now appear instantly, even when rating services are slow or down. Full sections say "Full". If a rating can't be loaded, a "Search RMP" link opens RateMyProfessors for that instructor. Settings has a new Campuses section, the first step toward supporting more universities.

**Privacy:** data handling is unchanged from 0.2.0. The privacy page already covers RateMyProfessors links. Confirm the hosted policy still matches `pages/privacy.html`.

Firefox has not been tested in a real Firefox browser for this release.
