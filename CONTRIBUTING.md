# Contributing to ProfCheck

ProfCheck is a free Chrome extension that adds instructor details and seat notices to university enrollment portals. It started at the University of Houston. Student developers can add their own campus by writing an **adapter**: a small file that reads their portal's course-search page.

Thanks for helping. Read this whole page before you start.

## Who owns what

- **Bryan Bogran** founded ProfCheck. He owns this repository and the Chrome Web Store listing, approves every merge, and decides which campuses, permissions, data sources, and branding ship.
- **Campus maintainers** build their campus's adapter, review changes to it, and test it on their own portal.
- Only Bryan has write access. Everyone else works from a fork and opens pull requests.

## Before your first pull request

1. **Sign the Contributor License Agreement.** Read [CLA.md](CLA.md). On your first pull request, a bot asks you to sign by commenting one sentence. You keep ownership of your work. The agreement lets ProfCheck use, change, and distribute it. You must be 18 or older.
2. **Open a campus request** (Issues → New issue → Campus request) and wait for Bryan to approve it. Don't start building before the request is approved.

## How adding a campus works

1. **Request.** Open a campus request issue with your school, portal host, GitHub handle, and second tester.
2. **Approve.** Bryan approves the exact portal host and the features on the issue.
3. **Build.** In your fork, copy the template, write the adapter, add synthetic fixtures and expected results, register the adapter, and add the approved host to the manifest's `optional_host_permissions`.
4. **Test locally.** Run `npm run check`, then load your fork unpacked in Chrome and check it on your live portal.
5. **Pull request.** Open a pull request using the template. Sign the CLA if the bot asks.
6. **Review.** Bryan checks that the adapter only reads the page, the fixtures are clean, the only manifest change is your approved host, and CI passes.
7. **Live test.** Bryan publishes a release-candidate build. You and your second tester each file a test report.
8. **Release.** Bryan merges, updates the privacy disclosures, and publishes to the Chrome Web Store. Your campus appears in settings, turned off by default.
9. **Maintain.** When your portal's layout changes, reproduce it with a new synthetic fixture, fix the adapter, and repeat steps 5–8.

## Setup

You need Git, Node.js 20 or newer, Python 3, and Chrome.

```sh
git clone https://github.com/<your-handle>/UH-ProfCheck.git
cd UH-ProfCheck
npm test        # unit and adapter tests
npm run scan    # checks fixtures for real student data
npm run check   # everything CI runs
```

**Load your build in Chrome**

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the repository folder.
3. Open ProfCheck settings, turn on your campus, and allow access when Chrome asks.
4. Reload your portal tab.

After you change code, click the reload icon on the ProfCheck card in `chrome://extensions`, then reload the portal tab.

## Writing an adapter

Start from [`src/adapters/_template.js`](src/adapters/_template.js). The full contract is in [`src/adapters/contract.md`](src/adapters/contract.md). Your campus's details (id, name, host, features) go in [`src/campuses.js`](src/campuses.js).

For each section on the page, an adapter returns the course code, the instructor name or "unassigned", where to attach the overlay, and the open and total seats when the page shows them. If the page doesn't show a value clearly, return `null`. Never guess.

**An adapter only reads the page.** The shared extension handles rendering, settings, permissions, and every network request. Adapter files may not use any of these, and a test will fail if they do:

- `fetch`, `XMLHttpRequest`, `import(`
- `chrome.`, `browser.`
- `eval`, `Function(`
- `setInterval`
- `localStorage`, `document.cookie`

Adapters also must not change the page except where the shared code tells them to, and must not read form fields, hidden inputs, or anything outside the course results.

## Fixture rules

Fixtures are fake HTML pages that copy the *structure* of your portal's results. Tests run against them so nobody needs a portal login.

- **Build fixtures by hand.** Never paste a page you saved from your portal, even if you edit it afterwards.
- Use made-up names (`Jane Example`), course numbers that look real, and fake IDs like `0000000`. Use `@example.edu` for any email address.
- Remove all `<script>` tags, hidden inputs, session values, and URLs that contain tokens or session IDs.
- Keep only the elements and attributes the adapter needs.
- Never commit credentials, student IDs, schedules, session URLs, or screenshots of your account.

`npm run scan` checks every fixture under `test/fixtures/campuses/` and fails if it finds something that looks like real data. Bryan also opens every fixture during review. If real data gets into a pull request, tell Bryan right away so it can be removed from the history.

## Test reports

Before release, you and a second student at your school each test the release-candidate build on your live portal and file a **Test report** issue. A campus needs two passing reports on the same build to ship. If there's only one tester, the campus stays in testing.

Screenshots in reports are allowed only if they're cropped to the results table and every student name, ID, and schedule detail is blacked out. Written results are preferred.

## When your campus breaks

Portals change their layouts. When someone reports a problem with a **Campus broken** issue:

1. Reproduce it and add a synthetic fixture of the new layout.
2. Fix the adapter and open a pull request.
3. File a test report on the new build.

If a break goes **14 days** without a fix, or without a tester who can verify one, Bryan ships an update that marks the campus **Paused** (off by default). It comes back after a fix is verified. Until then, ProfCheck shows nothing on pages it can't read reliably rather than showing wrong seat counts.

## Credit

Contributors are credited by name or GitHub handle, with their consent, in [CAMPUSES.md](CAMPUSES.md) and the release notes. Say in your pull request how you want to be credited, or that you'd rather not be named.

## Release checklist

Bryan follows [docs/launch-plan.md](docs/launch-plan.md) and [docs/RELEASE-CHECK.md](docs/RELEASE-CHECK.md) for every release.
