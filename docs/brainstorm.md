# ProfCheck brainstorm

Keep this document current as choices are made. When a proposal or open question is settled, move the outcome to **Decisions** and record the date and reason. Update **Pilot** as school access and data sources are confirmed.

## Decisions

- **Keep ProfCheck free for now.** Revisit monetization separately if Bryan decides to explore it.

### Campus contributor program (2026-11-17)

Settled while reviewing the campus contributor program plan.

**Ownership and rights**
- **One public repository.** Contributors fork the official `UH-ProfCheck` repo and open pull requests. There is no private adapter repo. Reason: shipped extension code is inspectable anyway, and test fixtures contain only synthetic data.
- **No public license. Every contributor signs a contributor agreement.** CLA Assistant Lite runs on pull requests, and the contributor signs with one comment. The agreement gives Bryan a perpetual, irrevocable license that allows relicensing and commercial use. The contributor keeps ownership. Contributors must be 18 or older. Reason: keeps a future sale or paid offering possible, and a public license would let anyone reuse the code commercially. Have a law clinic or a lawyer review the agreement text once.
- **The existing contributor (chaseum) signs the same agreement** before any license change, rebrand, or sale. If they decline, list which of their code would need rewriting.
- **Only Bryan can write to the repo.** Everyone else works through forks and pull requests.

**Extension behavior**
- **Campus switches, not a single picker.** Each campus has its own on/off switch, with UH on by default. Turning a campus on requests access to that campus's exact portal host, listed in the manifest's optional host permissions. The adapter is chosen by the actual page, so several campuses can be on at once.
- **Adapters only read the page.** They make no network requests. The shared code owns rendering, settings, permissions, and network access.
- **Adapter contract additions:** a flag for which frames the adapter runs in, and an optional URL path check for portals that share a host. Dark mode stays UH-only.
- **Show nothing rather than wrong data.** If an adapter's output fails basic checks (open seats greater than total, duplicate rows, zero rows on a results page), the overlay shows nothing on that page. There is no remote config. A broken campus is disabled by shipping a new version.
- **RateMyProfessors for every campus (2026-11-17).**
  - Any campus can show a "Search RMP" link built from the instructor's name and the campus's RMP school ID. It sends nothing until the student clicks, so pilot campuses still make no network requests of their own. UH shows it whenever a rating can't be shown. 0.3.0 also labels a failed CougarGrades request "CG unavailable" instead of "No CG Data".
  - **Ratings for other campuses (0.4.0):** call RMP directly from the background script. `ratemyprofessors.com` is requested as an optional host permission when a student turns on that campus, never as a required permission, because a required one would disable ProfCheck for every existing user. The endpoint is unofficial and RMP's terms restrict automated access, so the search link stays as the fallback. The privacy page must say that instructor names are sent to RMP for these campuses.
  - **UH stays on the CougarGrades RMP proxy,** so it needs no new permission. Emailing the CougarGrades maintainers about ProfCheck's traffic is deferred.
- **Missing features are hidden.** Grades, ratings, and rankings are hidden for a campus without an approved data source, with one note in the panel. CougarGrades is used for UH only.
- **One low-seat rule for all campuses,** the same threshold UH uses now, with tests for waitlisted and closed sections.

**Testing and release**
- **Test builds:** each release candidate is a GitHub Release with the ZIP and the commit it was built from. Testers load it as an unpacked extension.
- **Test reports:** an issue form asks for the build commit, the Chrome version, and pass/fail on these scenarios: search results, a refresh that replaces results, navigating away and back, an unassigned instructor, a full or waitlisted section, and switching the campus off then reloading. Screenshots must be cropped to the results table with student details redacted.
- **Fixtures:** built by hand with made-up names and IDs. Scripts, hidden form fields, and session values are removed. An automatic scan in the test harness fails on anything that looks like a student ID, email, session or token parameter, or a hidden field with a value. Bryan still reviews every fixture.
- **Two campus testers are required to ship.** With one tester, the campus stays in testing.
- **Privacy updates before each campus ships:** the privacy page, `docs/PRIVACY.md`, and the store's data disclosure list each campus and what it sends.

**Running the program**
- **Campus requests** come in through a GitHub issue form on the public repo: school, portal host, GitHub handle, course-search access, and second tester. The form never asks for student IDs or school emails.
- **Pause rule:** if a breakage goes 14 days without a maintainer response or a tester who can verify the fix, ship a version that turns that campus off by default and marks it "paused". Users can still turn it back on.
- **Branding for now:** keep the "UH ProfCheck" name and listing for the first outside campus, and add "Beta support for <campus>" to the description. Decide the rebrand before a second outside campus ships.

## Current baseline

UH ProfCheck is live on the Chrome Web Store and supports the University of Houston enrollment portal. It uses CougarGrades for instructor and course grade history and for RateMyProfessors lookups through the CougarGrades bridge. That integration is UH-specific, so the pilot needs to identify which data sources and features are available for the candidate school. [V2 documentation](README.md)

## Contributor flow

1. **Request.** The contributor opens a campus request issue.
2. **Approve.** Bryan approves the portal host and the feature scope on the issue.
3. **Build.** In their fork, the contributor writes the adapter from the template, adds a synthetic fixture and its expected results, registers the adapter, and adds the approved host to the manifest's optional host permissions.
4. **Test locally.** The contributor runs the tests (parser, fixture scan, and UH regressions) and checks an unpacked build on the live portal.
5. **Pull request.** The contributor opens a PR and signs the contributor agreement on their first one.
6. **Review.** Bryan checks that the adapter only reads the page, the fixtures are clean, the only manifest change is the approved host, and CI passes.
7. **Live test.** Bryan publishes a release-candidate build. Two campus testers file reports, and Bryan runs a UH smoke test.
8. **Release.** Bryan merges, bumps the version, updates the privacy disclosures, and publishes to the Chrome Web Store. The new campus appears in settings, turned off.
9. **Maintain.** A layout change is reported in an issue. The contributor fixes it with a new synthetic fixture, then steps 5–8 repeat. The 14-day pause rule applies.

## Pilot

A Reddit volunteer offered to help with Lone Star and Texas Tech. Give them the same discovery checklist for both schools. Pick the first campus where they have authorized course-search access, course and seat fields are reliable, and two testers are available. If both qualify, choose the one with the simpler host and page layout. The volunteer works through a fork and pull requests like any other contributor. The pilot ships course and instructor detection and low-seat notices only. Grades and ratings wait for a separately approved data source.

## Open questions

- **Website.** Decide whether to build a site that links to the official install, lists supported schools, and collects campus requests. This is outside the first release.
- **Branding.** Another store extension uses the ProfCheck name. Decide on a name before a second outside campus ships.
- **Campus data sources.** Decide which grade and rating sources other campuses can use. This is outside the first release.

## Deferred

- Paid campus setup or support.
- Subscriptions.
- A sale of the project.
- Firefox rollout for other campuses.
