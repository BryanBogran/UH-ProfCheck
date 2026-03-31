# Professor Overlay Extension

This is a starter Chrome extension that injects professor data into a university enrollment page.

## What it does

- Watches the enrollment page for instructor names.
- Looks up RateMyProfessor data through CougarGrades' public API bridge at `/api/external/rmp/search`.
- Looks up CougarGrades instructor statistics through `/api/instructor/{instructorName}`.
- Renders small inline chips next to the instructor name with links back to both source sites.

## Why this design

Scraping raw HTML from third-party sites is brittle. This starter uses the current public API surface exposed by `https://api.cougargrades.io`, which is more stable than parsing website markup and also avoids hard-coding a private RateMyProfessor GraphQL flow into the content script.

## Architecture

- `manifest.json`
  Registers the content script, background worker, and options page.
- `src/content.js`
  Runs on pages that match your configured URL patterns, finds professor names, and injects overlay chips.
- `src/background.js`
  Performs cross-origin fetches to CougarGrades and normalizes the combined response.
- `options/options.html`
  Lets you configure your enrollment URL pattern and the CSS selectors used to find course rows and instructor names.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this project folder.
5. Open the extension options and set:
   - your enrollment page URL pattern
   - the selector for each course row
   - the selector for the professor name inside that row

## Release notes

For peer sharing or Chrome Web Store submission, the extension is now restricted in the manifest to:

```text
https://saprd.my.uh.edu/*
```

That is much easier to justify than injecting on every site.

There is also a starter privacy policy in `PRIVACY.md`. If you publish to the Chrome Web Store, host that policy at a public URL and link it from the store listing if the listing flow requires it.

If the enrollment page is behind login, use the helper in the options page to discover the selectors from your own browser session.

## Important next step

The only part we cannot infer automatically is your enrollment page DOM. You will need to inspect the page and replace the placeholder selectors with the real ones from your university site.

For example, if your enrollment results table looks like this:

```html
<tr class="class-row">
  <td class="faculty-name">John Smith</td>
</tr>
```

Then these settings would work:

```text
Course Row Selector: tr.class-row
Instructor Selector: .faculty-name
```

## For the UH enrollment portal

The `saprd.my.uh.edu` enrollment pages are likely behind an authenticated PeopleSoft session, so I could not inspect the live DOM remotely. The starter extension now includes a selector probe in the options page that you can copy into DevTools Console while viewing the real class page.

Based on the professor element you found, a strong UH instructor selector is:

```text
span[id*="SSR_INSTR_LONG"]
```

That selector matches elements such as:

```html
<span class="ps_box-value psc_display-block psc_padding-bottom0_5em" id="SSR_CLSRCH_F_WK_SSR_INSTR_LONG_1$86$$0">Carlos Ordonez</span>
```

Based on the course element you found, a strong UH course selector is:

```text
span[id*="SSS_SUBJ_CATLG"]
```

For example:

```html
<span class="ps_box-value" id="SSR_CRSE_INFO_V_SSS_SUBJ_CATLG">COSC 3380</span>
```

When a course code is available, the extension now renders:

- `CG Prof` linking to the CougarGrades instructor page
- `CG COSC 3380` next to the course title/header, linking to the CougarGrades course page
- CougarGrades instructor badges for GPA and W rate only

What to send back:

1. The top 5-10 rows from the `console.table(...)` output.
2. If possible, the HTML for one row that contains the professor name.

Once we have that, we can lock in the exact `courseRowSelector` and `instructorSelector` for UH instead of relying on generic fallbacks.

## Likely improvements

- Better name matching for multiple instructors in one row.
- A popup for quick on/off toggles.
- Per-site selector profiles instead of one global profile.
- Smarter duplicate handling when the enrollment page re-renders.
- Optional course-level overlays in addition to instructor-level overlays.
# UH-ProfCheck
