# ProfCheck brainstorm

Keep this document current as choices are made. When a proposal or open question is settled, move the outcome to **Decisions** and record the date and reason. The work plan is [launch-plan.md](launch-plan.md).

## Decisions

- **Keep ProfCheck free for now.** Revisit monetization separately if Bryan decides to explore it.

### Launch redesign (2026-11-18)

Settled in a review of the 2026-11-17 plan. Where these differ from the 2026-11-17 decisions below, these win.

**What launch is**
- **Launch is 0.5.0.** It's a release with:
  - a new, school-neutral name on the same store listing;
  - a website with a "bring it to my school" button;
  - PeopleSoft and Banner 9 supported, with Texas Tech and Lone Star live as Beta;
  - adding a school on a supported system takes one data entry.

  UH users see only the new name. Reason: this is Bryan's launch vision, made checkable.
- **Release order.**
  - 0.4.0, still named "UH ProfCheck": direct RMP ratings, the `peoplesoft` and `banner9` adapters, and Texas Tech and Lone Star as Beta.
  - 0.5.0: the new name, the website, and the request flow.
  - After that: any-school switch-on, then Firefox.

  Reason: the new name launches only once other schools work, and each release changes one kind of thing.

**How schools are supported**
- **One adapter per registration system, not per school.** Bryan (with Claude) writes and owns `peoplesoft` (the UH adapter, generalized) and `banner9` (built from Texas Tech's public Browse Classes page). A school on a supported system is one entry in `src/campuses.js` with its host, system and RMP school ID. Reason: the adapter is the riskiest code, since it runs on logged-in student pages. Keeping it in Bryan's hands removes most of the review and legal burden, and launch doesn't depend on a volunteer's coding time.
- **"Plug and play" means:**
  - **At launch:** a request form with no code for schools on a supported system. For other systems, a guided code contribution with the agent guide.
  - **After launch:** any student can turn it on from their own registration page, with no request.
- **Direct RMP ratings come first, and a non-UH school doesn't launch without them.** Outside UH, ratings are the main reason to install, because grade history (CougarGrades) is UH-only and other portals already show seats. A rating is shown only when exactly one professor at that school matches the name. Otherwise the student sees the "Search RMP" link. UH stays on the CougarGrades proxy.
- **New schools ship in the regular store build as Beta, off by default.** No release-candidate ZIPs or unpacked test builds. The off-by-default switch acts as the feature flag, and the "show nothing rather than wrong data" checks protect anyone who turns a school on early.
- **The agent guide (`/add-campus`) goes live with 0.5.0, not before.** The parked `agent-guide` branch is rewritten for system adapters and combined with the `AGENTS.md` written on 2026-11-18.

**People**
- **Everyone who helps is a contributor. Each school has a maintainer.** The maintainer:
  - confirms the school works on their logged-in registration page;
  - re-checks it when a release changes their system's adapter;
  - answers "campus broken" reports.

  The 14-day pause rule still applies.
- **Beta → Supported** once the school's maintainer and one more contributor at that school both confirm it works. This replaces "two testers required to ship".
- **Maintainers must be 18 or older,** the same as code contributors. A minor can still report problems as a contributor, without being named.
- **The Reddit volunteer is the first maintainer,** for Texas Tech and Lone Star. They don't need to write code.
- **Credit:** maintainers are named on the website (name or GitHub handle) with their consent. A contributors page lists everyone else who tested, requested or built something, also with consent. "Founded by Bryan Bogran" stays in the footer.

**Requests**
- **The website's request button opens the GitHub campus request form.** It's free and public, and maintainers need a GitHub account anyway. Add a form that needs no account (Tally or Google Forms) later if requests come in slowly.
- **The form asks for:**
  - the school;
  - the portal address;
  - the system, if they know it;
  - whether they'll maintain it, with an 18+ checkbox if so.

  It no longer asks for the RMP school ID, which we look up ourselves, or a second tester.

**Brand and website**
- **Rename the existing listing,** not a new one. Reason: keeps current users, reviews and the update path.
- **Name rules:**
  - keep "Prof" or "ProfCheck" as the root;
  - not the bare name "ProfCheck": a UBC extension already uses it;
  - nothing like "CheckMyProf…": an extension with that name shows RMP ratings for Canadian schools;
  - nothing that echoes "RateMyProfessors": it implies a connection to RMP and invites a trademark complaint;
  - no school name or mascot;
  - short;
  - a `.com` or `.app` domain is available.

  Bryan's "CheckMyProfessor" idea is dropped because of the CheckMyProf conflict. The final pick stays open until 0.5.0.
- **Move to a GitHub organization at 0.5.0,** named after the brand and owned only by Bryan. Do it only after the name is final.
- **The website is a static GitHub Pages site.** It's one page:
  - what ProfCheck does, with a screenshot;
  - an install button;
  - supported schools, generated from `src/campuses.js`;
  - the request button;
  - links to the privacy policy and the contributors page.

  No accounts and no blog. It starts on the Pages address and moves to a custom domain (about $12 a year) when the name is final.

**Legal**
- **The contributor agreement is needed only for outside code.** `CLA.md` stays a draft and the agreement workflow stays in place. Contact a law clinic when the first outside student says they'll build a system adapter. Reason: schools on supported systems never need outside code.
- **chaseum's signature is needed only before a relicense or a sale,** not for the rename. Renaming changes nobody's rights to the code.

**Later**
- **Any-school switch-on** is the first release after launch. It uses `activeTab` plus a broad optional `https://*/*` permission, requested for one site at a time. It ships on its own because it gets a stricter store review.
- **Firefox comes after that,** as its own release.

### Campus contributor program (2026-11-17)

Settled while reviewing the campus contributor program plan. Items marked *Superseded* were replaced on 2026-11-18 (above).

**Ownership and rights**
- **One public repository.** Contributors fork the official `UH-ProfCheck` repo and open pull requests. There is no private adapter repo. Reason: shipped extension code is inspectable anyway, and test fixtures contain only synthetic data.
- **No public license. Every code contributor signs a contributor agreement.** CLA Assistant Lite runs on pull requests, and the contributor signs with one comment. The agreement gives Bryan a perpetual, irrevocable license that allows relicensing and commercial use. The contributor keeps ownership. Contributors must be 18 or older. Reason: keeps a future sale or paid offering possible, and a public license would let anyone reuse the code commercially. Have a law clinic or a lawyer review the agreement text once. *Superseded in part: the review waits until the first outside code pull request is coming.*
- ~~**The existing contributor (chaseum) signs the same agreement** before any license change, rebrand, or sale.~~ *Superseded: only before a relicense or a sale.* If they decline, list which of their code would need rewriting.
- **Only Bryan can write to the repo.** Everyone else works through forks and pull requests.

**Extension behavior**
- **Campus switches, not a single picker.** Each campus has its own on/off switch, with UH on by default. Turning a campus on requests access to that campus's exact portal host, listed in the manifest's optional host permissions. The adapter is chosen by the actual page, so several campuses can be on at once.
- **Adapters only read the page.** They make no network requests. The shared code owns rendering, settings, permissions, and network access.
- **Adapter contract additions:** a flag for which frames the adapter runs in, and an optional URL path check for portals that share a host. Dark mode stays UH-only.
- **Show nothing rather than wrong data.** If an adapter's output fails basic checks (open seats greater than total, duplicate rows, zero rows on a results page), the overlay shows nothing on that page. There is no remote config. A broken campus is disabled by shipping a new version.
- **RateMyProfessors for every campus.**
  - Any campus can show a "Search RMP" link built from the instructor's name and the campus's RMP school ID. It sends nothing until the student clicks. UH shows it whenever a rating can't be shown. 0.3.0 also labels a failed CougarGrades request "CG unavailable" instead of "No CG Data".
  - **Ratings for other campuses (0.4.0):** call RMP directly from the background script. `ratemyprofessors.com` is requested as an optional host permission when a student turns on that campus, never as a required permission, because a required one would disable ProfCheck for every existing user. The endpoint is unofficial and RMP's terms restrict automated access, so the search link stays as the fallback. The privacy page must say that instructor names are sent to RMP for these campuses.
  - **UH stays on the CougarGrades RMP proxy,** so it needs no new permission. Emailing the CougarGrades maintainers about ProfCheck's traffic is deferred.
- **Missing features are hidden.** Grades, ratings, and rankings are hidden for a campus without an approved data source, with one note in the panel. CougarGrades is used for UH only.
- **One low-seat rule for all campuses,** the same threshold UH uses now, with tests for waitlisted and closed sections.

**Testing and release**
- ~~**Test builds:** each release candidate is a GitHub Release with the ZIP and the commit it was built from.~~ *Superseded: schools ship as Beta in the store build.*
- **Test reports:** an issue form asks for pass/fail on these scenarios: search results, a refresh that replaces results, navigating away and back, an unassigned instructor, a full or waitlisted section, and switching the campus off then reloading. Screenshots must be cropped to the results table with student details redacted. *Updated: it asks for the store version instead of a release-candidate commit.*
- **Fixtures:** built by hand with made-up names and IDs. Scripts, hidden form fields, and session values are removed. An automatic scan in the test harness fails on anything that looks like a student ID, email, session or token parameter, or a hidden field with a value. Bryan still reviews every fixture.
- ~~**Two campus testers are required to ship.**~~ *Superseded: two confirmations (maintainer plus one contributor) move a school from Beta to Supported.*
- **Privacy updates before each campus ships:** the privacy page, `docs/PRIVACY.md`, and the store's data disclosure list each campus and what it sends.

**Running the program**
- **Campus requests** come in through a GitHub issue form on the public repo. The form never asks for student IDs or school emails. *Updated: fields changed on 2026-11-18.*
- **Pause rule:** if a breakage goes 14 days without a maintainer response or a contributor who can verify the fix, ship a version that turns that campus off by default and marks it "paused". Users can still turn it back on.
- ~~**Branding for now:** keep the "UH ProfCheck" name for the first outside campus.~~ *Superseded: 0.4.0 keeps the name; 0.5.0 renames.*

## Current baseline

ProfCheck 0.3.0 is live on the Chrome Web Store as "UH ProfCheck". It supports the University of Houston enrollment portal and includes the campus framework, with UH as the only campus. It uses CougarGrades for instructor and course grade history and for RateMyProfessors lookups through the CougarGrades bridge. [V2 documentation](README.md)

## How a school gets supported

1. **Request.** A student opens a campus request from the website. It asks for the school, portal address, system if known, and whether they'll maintain it.
2. **Supported system?** If the school runs PeopleSoft or Banner 9, we add one entry to `src/campuses.js` (host, system, RMP school ID) and check the public page if there is one.
3. **Ship as Beta.** The next store release includes the school, off by default.
4. **Maintainer confirms.** The maintainer turns it on in their store install and files a test report from their logged-in registration page.
5. **Supported.** Once the maintainer and one more contributor confirm it, the status changes in the next release.
6. **Unsupported system.** A student developer uses the agent guide to write a new system adapter and opens a pull request. They sign the contributor agreement on their first one. Bryan reviews: the adapter only reads the page, fixtures are synthetic, and CI passes. Then steps 3–5.
7. **Maintain.** A layout change is reported in a `campus-broken` issue. We fix the system adapter with a new synthetic fixture, and the maintainer confirms on the store build. The 14-day pause rule applies.

## Pilot schools

A Reddit volunteer offered to help with Lone Star and Texas Tech, and is the first maintainer for both.
- **Texas Tech:** Banner 9 at `registration.texastech.edu`. The public Browse Classes page (needs `mepCode=TTU`) shows "Instructor Name (Primary)", "N of M seats remain." and "N of M waitlist seats remain." The logged-in registration page still needs the maintainer's check.
- **Lone Star:** PeopleSoft Campus Solutions (Fluid) at `campus.lonestar.edu`, with a guest "View Classes" page. Whether its markup matches UH's classic PeopleSoft page is not confirmed yet. That check comes before generalizing the adapter.

## Open questions

- **The new name.** Pick from a checked shortlist before 0.5.0, using the name rules above.

## Deferred

- Paid campus setup or support.
- Subscriptions.
- A sale of the project.
- A request form that needs no GitHub account.
- Emailing the CougarGrades maintainers about ProfCheck's traffic.
