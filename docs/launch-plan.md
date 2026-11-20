# ProfCheck launch plan

Rewritten 2026-11-18. This replaces the 2026-11-17 plan, which had each school's volunteer write their own adapter. The decisions this plan relies on are in [brainstorm.md](brainstorm.md#launch-redesign-2026-11-18). Check items off here as they're done.

## What launch means

**Launch is 0.5.0:** a Chrome Web Store release in which:
- the extension has a new, school-neutral name, on the **same** store listing;
- a website lists supported schools and has a "bring it to my school" button;
- PeopleSoft and Banner 9 are supported, with Texas Tech and Lone Star live as Beta;
- a request from any school on a supported system becomes one line in `src/campuses.js`, shipped in the next release;
- a student developer at a school on an unsupported system can build an adapter with the agent guide and open a pull request;
- UH users see nothing change except the name.

## The idea in one paragraph

Schools don't each need their own code. Most run one of a few registration systems: UH and Lone Star run PeopleSoft, and Texas Tech runs Banner 9. So there is **one adapter per system**, written and owned by Bryan (with Claude). A school is **data**: its portal host, its system, and its RMP school ID. Outside students request schools and maintain them by testing on their own logged-in pages. They write code only for a system we don't support yet. Outside UH, the main thing ProfCheck offers is RateMyProfessors ratings next to each instructor, so direct RMP ratings are built first.

## Status (2026-11-18)

| Item | State |
|---|---|
| 0.3.0 (campus framework, UH only) | Live in the store. Tagged `v0.3.0`. `main` matches it |
| Campus registry, adapter contract, output checks, campus switches, background gating | Done in 0.3.0. Carried forward |
| RMP search link fallback | Done in 0.3.0 |
| Fixture scanner, CI, issue forms, `CONTRIBUTING.md`, `CAMPUSES.md` | Done. Need wording updates for the new flow (0.5.0) |
| `CLA.md` and `.github/workflows/cla.yml` | Drafted. Stay as drafts until the first outside code pull request is coming |
| Agent guide (`/add-campus`) | Parked on local branch `agent-guide` (`cc0011f`, unpushed). Update and merge in 0.5.0 |
| `AGENTS.md` and `docs/agents/` (issue tracker, triage labels, domain docs) | Written 2026-11-18, not committed |
| Texas Tech | Banner 9, `registration.texastech.edu`. Public "Browse Classes" page checked: it shows the primary instructor and "N of M seats remain." |
| Lone Star | PeopleSoft Campus Solutions (Fluid), `campus.lonestar.edu`. Whether its page matches UH's layout is **not confirmed yet** |

**Owners:** **B** = Bryan only (accounts, legal, approvals, store). **C** = code work Claude can do with Bryan reviewing. **M** = a school's maintainer.

---

## Order

```
0.3.0 (live) ──> 0.4.0: RMP direct + system adapters + TTU & Lone Star Beta ──> 0.5.0: rename + website + request flow = LAUNCH ──> any-school switch-on ──> Firefox
```

Each release changes one kind of thing, so store reviewers and current users see small steps:
- **0.4.0** keeps the name "UH ProfCheck". It adds features and schools.
- **0.5.0** adds no new parsing. It's the rename, the website, and the request flow.

---

## Track 0 — Housekeeping (B, now)

- [ ] **0.1** Commit `AGENTS.md`, `docs/agents/`, and this plan rewrite on `v2`.
- [ ] **0.2** Send the Reddit volunteer a short note: they're the first **maintainer** for Texas Tech and Lone Star, they won't need to write code, and what's asked of them is in S3 below. Confirm they're 18 or older.
- [ ] **0.3** Replace the old discovery checklist ([discovery-checklist.md](discovery-checklist.md)) with a shorter **maintainer check** (see S3). The old one asked for things we can now read from public pages.

---

## 0.4.0 — Direct ratings and two systems (still "UH ProfCheck")

### R. Direct RMP ratings (C, built first)

Outside UH, this is the reason to install. A school doesn't launch without it.

- [ ] **R1. Background lookup.** Add an RMP client to `src/background.js` that searches by instructor name within the campus's `rmpSchoolId` and returns the rating, difficulty, "would take again", number of ratings, and the professor's RMP link.
- [ ] **R2. Show nothing rather than a wrong match.** Normalize names ("Doe, Jane" ↔ "Jane Doe", middle initials). Show a rating only when exactly one professor at that school matches. When there are zero or several matches, show the "Search RMP" link instead.
- [ ] **R3. Permission.** Add `https://www.ratemyprofessors.com/*` to `optional_host_permissions`. Request it in the same click that turns a school on. If the student declines, the school still turns on, with seat chips and the search link only. Optional hosts carry no warning on update, so current users aren't disabled.
- [ ] **R4. Gating.** Add a new data source, `rmp-direct`, to the campus `dataSources` check in `src/background.js`. UH keeps `cougargrades` + `rmp` (the CougarGrades proxy) and gets no new permission.
- [ ] **R5. Caching and failure.** Cache results per instructor and school for the session. If RMP fails or changes its response, fall back to the search link and log once, quietly, as 0.3.0 does for CougarGrades outages.
- [ ] **R6. Tests:** single match, no match, several matches, name formats, RMP down, permission declined, and no request from a school without `rmp-direct`.

### P. PeopleSoft system adapter (C)

- [ ] **P1. Confirm Lone Star first.** Open Lone Star's guest "View Classes" page and compare its results markup with UH's: the instructor span (`SSR_INSTR_LONG`), the course header (`SSS_SUBJ_CATLG`), and the "Open Seats N of M" text. UH uses the classic page and Lone Star uses Fluid, so they may differ. Record what's found in `brainstorm.md`.
- [ ] **P2. Generalize.** Rename `src/adapters/uh.js` to `src/adapters/peoplesoft.js`. Add `system` to each campus in `src/campuses.js`, and have `contentScriptFilesFor` load `src/adapters/<system>.js` instead of `<id>.js`. If Lone Star's Fluid layout differs, support both layouts in the one adapter, chosen by what's on the page, not by school.
- [ ] **P3. Per-school differences stay data.** Anything that varies between PeopleSoft schools (seat-text wording, instructor placeholder like "Staff" or "TBA") goes into an optional `systemOptions` field on the campus entry, not into a new adapter.
- [ ] **P4. No change for UH.** All existing tests pass unchanged, and a live check of COSC 1336 and MATH 2414 matches `RELEASE-CHECK.md`.

### B. Banner 9 system adapter (C)

- [ ] **B1. Build from the public page.** Texas Tech's "Browse Classes" page is public (`registration.texastech.edu/StudentRegistrationSsb/...`, needs `mepCode=TTU`). Read its results table: course, section, "Instructor Name (Primary)", "N of M seats remain.", and "N of M waitlist seats remain."
- [ ] **B2. Write `src/adapters/banner9.js`** using the same contract as PeopleSoft. Banner 9 replaces results without a page reload, so test re-search and paging with the existing MutationObserver.
- [ ] **B3. Synthetic fixtures** under `test/fixtures/campuses/banner9/`, built by hand from the public page's structure: normal rows, an unassigned instructor, a full section, a waitlisted section, and replaced results. The fixture scanner must pass.
- [ ] **B4. Check the logged-in page.** The registration page students use when signed in may differ from Browse Classes. The maintainer confirms this in S3 before the school is called Supported.

### S. Schools (C writes, M confirms)

- [ ] **S1. Add two entries** to `src/campuses.js`: Texas Tech (`system: "banner9"`) and Lone Star (`system: "peoplesoft"`), each with its host, any `pathPattern`, `status: "beta"`, `defaultEnabled: false`, `dataSources: ["rmp-direct"]`, and an RMP school ID that we look up ourselves. Add each host to `optional_host_permissions`.
- [ ] **S2. Features:** seats, instructors, ratings, ratings link. Grades and rankings stay UH-only (CougarGrades is UH data).
- [ ] **S3. Maintainer check** (M, after 0.4.0 is live). On the normal store install, turn the school on and check the logged-in registration page: results show, re-search replaces chips, an unassigned instructor, a full or waitlisted section, a rating that matches the professor, and turning the school off. Report with the test-report issue form.
- [ ] **S4. Beta → Supported** once the maintainer and one more contributor at that school have both filed passing reports. Update `status` in a later release and in `CAMPUSES.md`.

### 0.4.0 release gates (B, C helping)

- [ ] `npm run check` is green: all UH tests, the new system fixtures, and the RMP client tests.
- [ ] **Upgrade test** from 0.3.0: no permission warning, the extension isn't disabled, settings are kept, and UH works.
- [ ] **Turning on a school:** both permission prompts (the school's host and RMP) work, declining either one behaves as described, and turning it off removes the scripts.
- [ ] **No crossover:** a UH tab and a Texas Tech tab open at the same time each use their own adapter.
- [ ] **Privacy:** `pages/privacy.html`, `docs/PRIVACY.md`, and the store's data disclosure say that, for schools other than UH, instructor names are sent to RateMyProfessors when ratings are on. The hosted policy matches.
- [ ] **Listing:** the description adds "Beta support for Texas Tech and Lone Star College". The single-purpose text says "course search on supported university enrollment portals". The `scripting` and optional host justifications are filled in.
- [ ] Inspect the ZIP: no `test/` or `example.js`, and the required hosts are still exactly `api.cougargrades.io` and `saprd.my.uh.edu`.
- [ ] Update `RELEASE-CHECK.md`, tag `v0.4.0`, merge to `main`, publish, and watch reviews and errors for about a week.

**Done when:** 0.4.0 is live, UH has had no regressions for a week, and the maintainer has filed at least one passing report for one of the two schools.

---

## 0.5.0 — Launch

### N. The name (B decides, C checks)

- [ ] **N1. Pick from the checked shortlist.** The rules:
  - keep "Prof" or "ProfCheck" as the root, so UH students recognize it;
  - not the bare name "ProfCheck" (taken by a UBC extension), nothing like "CheckMyProf" (taken, same niche), nothing that echoes "RateMyProfessors";
  - no school name or mascot;
  - short enough for the toolbar and store search;
  - a `.com` or `.app` domain is available.
- [ ] **N2. Final checks** on the pick: Chrome Web Store search, a USPTO trademark search, and the GitHub organization name.
- [ ] **N3. Rename everywhere:** `manifest.json` `name` and `short_name`, the options page, launcher, console tags (`[ProfCheck:…]`), `README.md`, privacy pages, store listing title and description, and store screenshots. Icons only if the old ones say "UH".
- [ ] **N4. Buy the domain** and point it at GitHub Pages.

### G. GitHub organization (B)

- [ ] **G1.** Create the organization under the new name, owned only by Bryan. Transfer the repo. GitHub keeps issues, stars and history, and redirects the old links.
- [ ] **G2.** Update every link that names `BryanBogran/UH-ProfCheck`: issue forms, `CONTRIBUTING.md`, `AGENTS.md`, `docs/agents/issue-tracker.md`, and the privacy policy URL in the store dashboard.
- [ ] **G3.** Turn on branch protection for `main`: require a pull request and CI, no force pushes, admin bypass for Bryan's releases.

### W. Website (C builds, B approves)

GitHub Pages, one page, no accounts and no blog. Start on the Pages address and move to the custom domain at N4.

- [ ] **W1.** What it does, with a screenshot, and an install button linking to the store listing.
- [ ] **W2.** Supported schools with their system and status, **generated from `src/campuses.js`** at build time so it never goes stale. Maintainers are named (or shown by GitHub handle) only with their consent.
- [ ] **W3.** A "Bring it to my school" button that opens the GitHub campus request form.
- [ ] **W4.** Links to the privacy policy and a contributors page listing everyone who tested, requested or built something, with consent. "Founded by Bryan Bogran" in the footer.
- [ ] **W5.** Move the hosted privacy policy onto the site, and update the URL in the store dashboard.

### Q. Request flow (C drafts, B approves)

- [ ] **Q1. Campus request form** (`.github/ISSUE_TEMPLATE/campus-request.yml`). It asks for:
  - school;
  - portal address (hostname only);
  - the system, if they know it;
  - whether they'll be the maintainer;
  - if yes, a required "I am 18 or older" checkbox;
  - the privacy checkbox.

  Remove the RMP school ID field and the second-tester field.
- [ ] **Q2. Triage.** A request on a supported system gets `ready-for-agent`: Claude checks the public page if there is one, adds the campus entry, and it ships as Beta in the next release. A request on an unsupported system is answered with the agent-guide path (A1). Use the labels in `docs/agents/triage-labels.md`.
- [ ] **Q3. Test-report form.** Reword it for maintainers and contributors on the store build: drop the release-candidate fields, and add the extension version from `chrome://extensions`.
- [ ] **Q4. `CONTRIBUTING.md` and `CAMPUSES.md`:** the three roles (contributor, maintainer, code contributor), what a maintainer does, the 18+ rule for maintainers and code contributors, the Beta → Supported bar, and the 14-day pause rule. Add a System column to `CAMPUSES.md`.

### A. Agent guide (C)

- [ ] **A1.** Rebase the local `agent-guide` branch onto `v2`. Rewrite `docs/agents/add-a-campus.md` and `.claude/skills/add-campus/SKILL.md` for the new approach: first check whether the school's system is already supported, and if so, add a campus entry; if not, write a new **system** adapter, not a school adapter.
- [ ] **A2.** Combine its `AGENTS.md` and `CLAUDE.md` with the `AGENTS.md` written on 2026-11-18. Keep one `## Agent skills` block.
- [ ] **A3.** Merge it as part of 0.5.0, not before.

### L. Legal (B)

- [ ] **L1.** Leave `CLA.md` as a draft and the agreement workflow in place. When the first outside student says they'll build a system adapter, then: send `CLA.md` to a law clinic (UH Law's entrepreneurship/IP clinics), finish the `cla-signatures` branch setup in `cla.yml`, and test it from a second account.
- [ ] **L2.** chaseum's signature isn't needed for the rename. Ask for it only before a relicense or sale.

### 0.5.0 release gates

- [ ] Same checks as 0.4.0, plus: the new name shows everywhere a UH user looks, nothing else changes for them, and the upgrade from 0.4.0 shows no warning.
- [ ] The website is live on the custom domain, the school list matches `src/campuses.js`, and the request button opens the form.
- [ ] Update `RELEASE-CHECK.md`, tag `v0.5.0`, merge to `main`, publish.
- [ ] Announce: the Reddit thread, and anywhere the maintainers suggest at their schools.

**Done = LAUNCH.**

---

## After launch

### Any-school switch-on (the first release after launch)
A student installs the extension, opens their registration page, and clicks the toolbar button. If the page looks like PeopleSoft or Banner 9, ProfCheck offers to turn on for that site. No request needed.
- Needs `activeTab` and a broad optional permission, `https://*/*`, requested only for the one site the student clicked on.
- Expect a stricter store review. Ship it on its own, after 0.5.0 has been live for a while.
- A school turned on this way shows ratings only if we can find its RMP school ID. Otherwise it gets the search link.

### Firefox
Its own release after that. The `feature/firefox-support` branch is based on 0.2.0. Check Firefox's support for `scripting.registerContentScripts` with `persistAcrossSessions` and optional host permissions, and test in a real Firefox.

### Keeping schools working
- **Broken school:** someone opens a `campus-broken` issue, and Bryan labels it and records the date. Claude reproduces it with a new synthetic fixture and fixes the system adapter, the maintainer confirms on the store build, and a patch ships. **14 days** with no fix or no maintainer to confirm → ship a patch that marks the school "Paused" (off by default; students can turn it back on).
- **The output checks protect students meanwhile.** A broken layout usually trips them and shows nothing instead of wrong seat counts.
- **A change to a system adapter** gets a re-check from the maintainer of every school on that system.

---

## Retired from the 2026-11-17 plan

- Each school's volunteer writing their own adapter through a fork. Now only for unsupported systems.
- Release-candidate ZIPs loaded unpacked. Schools ship as Beta in the store build instead.
- Two testers required before a school ships. Now the bar for **Supported**, not for shipping.
- Law-clinic review and the agreement before launch. Now only when the first outside code pull request is coming.
- chaseum signing before the rebrand.
- Picking one pilot school. Both ship in 0.4.0.

---

## Risks to watch

| Risk | What happens | Mitigation |
|---|---|---|
| RMP changes or blocks its unofficial endpoint | Ratings disappear at non-UH schools | Fall back to the search link, quietly (R5). The listing never promises ratings at every school |
| RMP's terms restrict automated access | RMP complaint or store takedown request | One lookup per instructor shown, cached, no bulk scraping. Independence from RMP stated in the listing. Name avoids echoing RMP |
| A wrong professor is matched | A student sees the wrong rating | Exact single-match rule (R2); otherwise the search link |
| Lone Star's Fluid page differs from UH's classic page | PeopleSoft adapter doesn't work there | Check first (P1); support both layouts in one adapter |
| The logged-in Banner page differs from the public one | Texas Tech doesn't work for signed-in students | Ships as Beta, off by default; maintainer check (S3) before Supported |
| Upgrade causes a permission warning | Chrome disables the extension for every UH user | Only optional hosts are added; upgrade test in every release |
| The rename confuses UH users | Uninstalls or bad reviews | Same listing, same icon if possible, a line in the description: "formerly UH ProfCheck" |
| The maintainer goes quiet | A school can't move past Beta | It stays Beta and still works; the request form finds others; the 14-day rule covers breakage |
| Real student data lands in the repo | Privacy incident in git history | Fixture scanner in CI, by-hand fixtures, Bryan opens every fixture |

---

## Rough effort

| Work | Effort | Can start |
|---|---|---|
| Track 0 | An hour | Now |
| R (direct RMP) | 2–3 sessions | Now |
| P (PeopleSoft) | 1–2 sessions, after the Lone Star check | Now |
| B (Banner 9) | 2–3 sessions | Now |
| 0.4.0 gates and store review | A session plus days of review, then a week watching | After R, P, B, S |
| N, G, W, Q, A | 3–5 sessions, plus Bryan's name pick and domain purchase | Name and website can start during 0.4.0 |

Critical path: **R → 0.4.0 live + a week → rename + website → 0.5.0 store review.**
