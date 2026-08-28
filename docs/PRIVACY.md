# Privacy Policy

Professor Overlay is designed for the University of Houston enrollment portal.

## What the extension accesses

- The extension reads professor names and course codes from the currently open UH enrollment page at `https://saprd.my.uh.edu/*`.
- The extension does not read unrelated tabs or unrelated websites.

## What the extension sends off-device

- Professor names are sent to `https://api.cougargrades.io/api/external/rmp/search` to look up RateMyProfessor data.
- Professor names are sent to `https://api.cougargrades.io/api/instructor/{name}` to look up CougarGrades instructor data.
- Course codes are used locally to construct CougarGrades course links such as `https://cougargrades.io/c/COSC%203380`.

## What the extension stores

- User configuration such as selectors and toggles is stored with Chrome sync storage.
- No browsing history, authentication cookies, student IDs, schedules, or form submissions are intentionally stored by the extension.

## Data sharing

- The extension does not sell user data.
- The extension does not send analytics, ads, or telemetry to the developer.
- The only network requests made by the extension are the CougarGrades API requests needed to fetch professor metadata.

## Security notes

- The extension does not execute remote code.
- The extension opens external links in a new tab with `noopener,noreferrer`.
- The extension is scoped to the UH enrollment domain in the manifest.

## Contact

Before publishing to the Chrome Web Store, host this policy at a stable public URL and use that URL in the store listing if required.
