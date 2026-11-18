// Shared engine: picks the campus adapter for this page, checks what it returns,
// and renders seat notices, ratings, grades, and rankings. Adapters only read
// the page (src/adapters/*.js); everything with side effects lives here.
(async function initProfessorOverlay() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const DEFAULT_CONFIG = globalThis.PROFCHECK_DEFAULTS;
  const CAMPUSES = globalThis.PROFCHECK_CAMPUSES;
  const ADAPTERS = globalThis.PROFCHECK_ADAPTERS;
  const PARSE = globalThis.PROFCHECK_PARSE;
  const { SCORING_MODES, computeScore, pickBadgedProfessors } = globalThis.PROFCHECK_SCORING;
  const { normalizeWhitespace, formatNumber, formatPercent } = PARSE;

  const SEAT_PRESSURE_MAX_OPEN = 5;
  const SEAT_PRESSURE_MAX_RATIO = 0.1;
  // More than this share of an adapter's sections failing checks hides the page.
  const MAX_REJECTED_SHARE = 0.5;
  const NO_BADGED_PROFESSORS = new Set();
  const SELECTOR_KEYS = ["courseRowSelector", "instructorSelector", "courseCodeSelector"];
  const LOOKUP_SETTINGS = new Set([
    "showRmp", "showCougarGrades", "universityName", "rmpStrictSearch",
    "cougarGradesApiBaseUrl", "cougarGradesBaseUrl", "rmpProfessorBaseUrl",
    ...SELECTOR_KEYS
  ]);

  // Content scripts run in an isolated world, so only extension test pages can
  // set PROFCHECK_PAGE_URL; the live page cannot.
  const campus = CAMPUSES.campusForUrl(globalThis.PROFCHECK_PAGE_URL ?? location.href);
  const adapter = campus && ADAPTERS.get(campus.id);
  if (!adapter) {
    return;
  }

  const hasLookups = campus.dataSources.length > 0;
  const hasGradeSource = campus.dataSources.includes("cougargrades");
  const features = campus.features;

  const stored = await extensionApi.storage.sync.get([...Object.keys(DEFAULT_CONFIG), "campuses"]);
  const config = { ...DEFAULT_CONFIG, ...stored };
  validateConfig();
  let active = isCampusEnabled(stored.campuses);

  publishCampusState();

  // Section state is keyed by its anchor node and pruned once that node
  // detaches or changes, so PeopleSoft postbacks cannot pile up detached DOM.
  const sectionsByAnchorNode = new Map();
  const anchorNodesByCourseCode = new Map();
  const rankingsByCourseCode = new Map();
  const inFlightLookups = new Map();
  const courseOverlays = new Map();
  let instructorClaimsByRow = new WeakMap();
  let warnedAboutRejection = false;

  const observer = new MutationObserver(handlePageMutations);
  let queuedScanFrame = 0;

  if (active) {
    scanPage();
    observePage();
  }

  window.addEventListener("pagehide", stopObserving, { once: true });
  extensionApi.storage.onChanged.addListener(applyChangedSettings);

  function isCampusEnabled(campusSettings) {
    return campusSettings?.[campus.id]?.enabled ?? campus.defaultEnabled;
  }

  /** Lets the launcher say which features this campus does not have yet. */
  function publishCampusState() {
    const unavailable = ["grades", "ratings", "rankings"].filter((feature) => !features[feature] || !hasLookups);
    globalThis.PROFCHECK_ACTIVE_CAMPUS = Object.freeze({
      id: campus.id,
      displayName: campus.displayName,
      enabled: active,
      unavailableFeatures: Object.freeze(unavailable),
      note: unavailable.length ? `Grades & ratings not yet available for ${campus.displayName}` : ""
    });
    document.documentElement.dataset.profcheckCampus = campus.id;
    document.dispatchEvent(new CustomEvent("profcheck:campus-state"));
  }

  function observePage() {
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
  }

  function stopObserving() {
    observer.disconnect();
    cancelAnimationFrame(queuedScanFrame);
    queuedScanFrame = 0;
  }

  function handlePageMutations(mutations) {
    if (mutations.every(isOwnMutation)) {
      return;
    }

    if (queuedScanFrame) {
      return;
    }

    queuedScanFrame = requestAnimationFrame(() => {
      queuedScanFrame = 0;
      // Detached across the scan so the hosts we insert cannot re-trigger it.
      observer.disconnect();
      scanPage();
      observePage();
    });
  }

  function isOwnMutation(mutation) {
    const selector = ".prof-overlay-host, .prof-overlay, .profcheck-launcher";
    const target = mutation.target.nodeType === Node.ELEMENT_NODE
      ? mutation.target : mutation.target.parentElement;
    if (target?.closest(selector)) return true;
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return changedNodes.length > 0 && changedNodes.every((node) => node.matches?.(selector));
  }

  function adapterContext() {
    return {
      parse: PARSE,
      campus,
      selectors: {
        courseRow: config.courseRowSelector,
        instructor: config.instructorSelector,
        courseCode: config.courseCodeSelector
      }
    };
  }

  function scanPage() {
    const found = readSections();
    if (!found) {
      clearAllOverlays();
      return;
    }

    // Anything the adapter no longer reports, or now reports differently, is stale.
    sectionsByAnchorNode.forEach((section, anchorNode) => {
      const current = found.get(anchorNode);
      if (!current || sectionIdentity(current) !== section.identity) {
        dropSection(section);
      }
    });
    removeOrphanedHosts();
    reconcileCourseHeaders();

    found.forEach((reported, anchorNode) => {
      const section = sectionsByAnchorNode.get(anchorNode);
      if (section) {
        section.seats = reported.seats;
        section.waitlisted = reported.waitlisted;
      } else {
        startSection(reported);
      }
    });

    rebuildRankings();
  }

  /**
   * Runs the adapter and applies the shared output checks. Returns a Map of
   * anchor → section, or null when the page should show nothing at all.
   */
  function readSections() {
    let reported;
    try {
      reported = adapter.findSections(document, adapterContext());
      if (!Array.isArray(reported)) throw new TypeError("findSections must return an array");
    } catch (error) {
      warnRejected(`adapter failed: ${error.message}`);
      return null;
    }

    const accepted = new Map();
    let rejected = 0;
    reported.forEach((section) => {
      if (isValidSection(section) && !accepted.has(section.anchor)) {
        accepted.set(section.anchor, normalizeSection(section));
      } else {
        rejected += 1;
      }
    });

    if (reported.length && rejected / reported.length > MAX_REJECTED_SHARE) {
      warnRejected(`${rejected} of ${reported.length} sections failed checks`);
      return null;
    }

    return accepted;
  }

  function warnRejected(reason) {
    if (warnedAboutRejection) return;
    warnedAboutRejection = true;
    console.warn(`[ProfCheck:${campus.id}] Overlays hidden on this page: ${reason}`);
  }

  function isValidSection(section) {
    if (!section || !(section.anchor instanceof Element) || !section.anchor.isConnected) return false;
    if (section.row != null && !(section.row instanceof Element)) return false;
    if (typeof section.unassigned !== "boolean") return false;
    if (section.instructor != null && typeof section.instructor !== "string") return false;
    if (!section.instructor && !section.unassigned) return false;
    if (section.courseCode != null && typeof section.courseCode !== "string") return false;
    if (section.waitlisted != null && typeof section.waitlisted !== "boolean") return false;
    return section.seats == null || isValidSeats(section.seats);
  }

  function isValidSeats({ open, total } = {}) {
    return Number.isInteger(open) && Number.isInteger(total)
      && open >= 0 && total > 0 && open <= total;
  }

  function normalizeSection(section) {
    return {
      anchorNode: section.anchor,
      row: section.row ?? null,
      courseCode: section.courseCode || "",
      professorName: section.unassigned ? "" : section.instructor,
      isPlaceholder: section.unassigned,
      instructorText: normalizeWhitespace(section.anchor.textContent),
      seats: section.seats ?? null,
      waitlisted: section.waitlisted ?? null
    };
  }

  function sectionIdentity(section) {
    return `${section.instructorText}\u0000${section.courseCode}\u0000${section.isPlaceholder}`;
  }

  function startSection(reported) {
    const claimKey = reported.professorName.toLowerCase() || `tba::${reported.courseCode}`;
    if (!claimInstructorInRow(reported, claimKey)) {
      return;
    }

    const section = {
      ...reported,
      identity: sectionIdentity(reported),
      claimKey,
      hostNode: null,
      result: null,
      courseResult: null,
      lookupSettled: !hasLookups
    };

    sectionsByAnchorNode.set(section.anchorNode, section);
    getOrCreate(anchorNodesByCourseCode, section.courseCode, () => new Set()).add(section.anchorNode);

    if (hasLookups) {
      lookUp(section);
    }
  }

  function dropSection(section) {
    const claims = section.row && instructorClaimsByRow.get(section.row);
    if (claims?.get(section.claimKey) === section.anchorNode) claims.delete(section.claimKey);
    sectionsByAnchorNode.delete(section.anchorNode);
    anchorNodesByCourseCode.get(section.courseCode)?.delete(section.anchorNode);
    highlightRow(section, false);
    section.hostNode?.remove();
  }

  async function lookUp(section) {
    const { anchorNode, professorName, courseCode } = section;
    try {
      const response = professorName
        ? await requestLookup(`professor::${professorName.toLowerCase()}::${courseCode}`, {
          type: "LOOKUP_PROFESSOR",
          payload: { professorName, courseCode }
        })
        : await requestLookup(`course::${courseCode}`, {
          type: "LOOKUP_COURSE",
          payload: { courseCode }
        });

      // The node can be replaced by a postback while the lookup is in flight.
      if (sectionsByAnchorNode.get(anchorNode) !== section) {
        return;
      }

      section.lookupSettled = true;
      if (response?.ok && response.result) {
        if (professorName) {
          section.result = response.result;
        } else {
          section.courseResult = response.result;
        }
        renderSectionAndBadge(section);
      } else {
        renderOverlay(section);
      }
    } catch (error) {
      console.error("Unable to render section overlay", error);
    }
  }

  /**
   * A postback can replace the instructor name while leaving our host behind, as
   * the host sits outside the wrapper the page rewrites. An orphan never renders
   * again, so it freezes on the mode it last drew and reads as a duplicate.
   */
  function removeOrphanedHosts() {
    document.querySelectorAll(".prof-overlay-host").forEach((host) => {
      const anchorNode = host.previousElementSibling;
      if (!anchorNode || sectionsByAnchorNode.get(anchorNode)?.hostNode !== host) {
        host.remove();
      }
    });
  }

  function reconcileCourseHeaders() {
    const showHeaders = hasGradeSource && features.grades && config.showCougarGrades
      && typeof adapter.findCourseHeaders === "function";
    let headers = [];
    if (showHeaders) {
      try {
        headers = adapter.findCourseHeaders(document, adapterContext()) ?? [];
      } catch (error) {
        console.warn(`[ProfCheck:${campus.id}] Course headers skipped: ${error.message}`);
      }
    }

    const current = new Map(headers
      .filter((header) => header?.anchor instanceof Element && header.courseCode)
      .map((header) => [header.anchor, header.courseCode]));

    courseOverlays.forEach(({ courseCode, overlay }, node) => {
      if (!node.isConnected || current.get(node) !== courseCode || !overlay.isConnected) {
        overlay.remove();
        courseOverlays.delete(node);
      }
    });

    current.forEach((courseCode, node) => {
      if (!courseOverlays.has(node)) {
        courseOverlays.set(node, { courseCode, overlay: renderCourseHeaderOverlay(node, courseCode) });
      }
    });
  }

  function requestLookup(cacheKey, message) {
    let lookup = inFlightLookups.get(cacheKey);
    if (!lookup) {
      lookup = extensionApi.runtime.sendMessage(message)
        .finally(() => {
          if (inFlightLookups.get(cacheKey) === lookup) inFlightLookups.delete(cacheKey);
        });
      inFlightLookups.set(cacheKey, lookup);
    }

    return lookup;
  }

  /**
   * One chip set per instructor per option row, however many classes that option
   * lists. A lecture and its lab name the same person, and repeating the figures
   * against each only adds height to a row that is already tight.
   */
  function claimInstructorInRow({ anchorNode, row }, claimKey) {
    if (!row) {
      return true;
    }

    const claims = getOrCreate(instructorClaimsByRow, row, () => new Map());

    // A claim held by a node the page has since replaced is stale, not a conflict.
    const holder = claims.get(claimKey);
    if (holder && holder !== anchorNode && holder.isConnected) {
      return false;
    }

    claims.set(claimKey, anchorNode);
    return true;
  }

  function getOrCreate(map, key, createValue) {
    let value = map.get(key);
    if (!value) {
      value = createValue();
      map.set(key, value);
    }

    return value;
  }

  function renderSectionAndBadge(section) {
    const { courseCode } = section;
    // The first section to resolve has no rival yet, so nothing is badged. A later
    // arrival can make it eligible, and only a redraw will show that.
    const previousKeys = new Set(badgedProfessorKeys(courseCode));
    updateBestProfessor(section);
    const currentKeys = badgedProfessorKeys(courseCode);

    renderOverlay(section);

    if (isSameKeySet(previousKeys, currentKeys)) {
      return;
    }

    // Anyone who joined or left the group needs redrawing: a badge can appear, move,
    // vanish, or change wording when a sole winner becomes one of several.
    const affectedKeys = new Set([...previousKeys, ...currentKeys]);
    anchorNodesByCourseCode.get(courseCode)?.forEach((peerNode) => {
      const peerSection = sectionsByAnchorNode.get(peerNode);
      if (peerSection && peerSection !== section && affectedKeys.has(getProfessorKey(peerSection))) {
        renderOverlay(peerSection);
      }
    });
  }

  function isSameKeySet(left, right) {
    return left.size === right.size && [...left].every((key) => right.has(key));
  }

  function updateBestProfessor(section) {
    const professorKey = getProfessorKey(section);
    if (!features.rankings || !professorKey || !section.courseCode || !section.result) {
      return;
    }

    // Counted as a rival even when unscored, so "best of one" never gets a badge.
    const ranking = getOrCreate(rankingsByCourseCode, section.courseCode, () => (
      { professorKeys: new Set(), scoresByProfessorKey: new Map(), badgedKeys: null }
    ));
    ranking.professorKeys.add(professorKey);

    const score = computeScore({
      rmp: config.showRmp && features.ratings ? section.result.rmp : null,
      cougarGrades: config.showCougarGrades && features.grades ? section.result.cougarGrades : null
    }, SCORING_MODES[config.defaultScoringMode].weights);
    if (score == null) {
      return;
    }

    const knownScore = ranking.scoresByProfessorKey.get(professorKey);
    if (knownScore != null && knownScore >= score) {
      return;
    }

    ranking.scoresByProfessorKey.set(professorKey, score);
    ranking.badgedKeys = null;
  }

  function badgedProfessorKeys(courseCode) {
    const ranking = rankingsByCourseCode.get(courseCode);
    if (!ranking) {
      return NO_BADGED_PROFESSORS;
    }

    if (!ranking.badgedKeys) {
      ranking.badgedKeys = pickBadgedProfessors(ranking.scoresByProfessorKey, ranking.professorKeys.size);
    }

    return ranking.badgedKeys;
  }

  function isBestProfessor(section) {
    return badgedProfessorKeys(section.courseCode).has(getProfessorKey(section));
  }

  function renderOverlay(section) {
    const hostNode = ensureOverlayHost(section);
    if (!hostNode) {
      return;
    }

    const { result, courseResult } = section;
    const overlay = document.createElement("div");
    overlay.className = "prof-overlay";

    const isBest = Boolean(result) && isBestProfessor(section);
    highlightRow(section, isBest);

    if (isBest) {
      const { label } = SCORING_MODES[config.defaultScoringMode];
      const sharedWith = badgedProfessorKeys(section.courseCode).size - 1;
      const courseName = section.courseCode || "this course";
      overlay.append(createChip({
        label: sharedWith ? "Top Pick" : label,
        title: sharedWith
          ? `One of the top ${sharedWith + 1} options for ${courseName} by ${label} — too close to separate: ${describeInstructor(result)}`
          : `${label} pick for ${courseName}: ${describeInstructor(result)}`,
        href: result.cougarGrades?.link || result.rmp?.link,
        modifier: sharedWith ? "best-tied" : "best"
      }));
    }

    if (features.ratings && config.showRmp && result?.rmp?.avgRating != null && result.rmp.numRatings > 0) {
      const ratingCount = result.rmp.numRatings;
      overlay.append(createChip({
        label: `Rating ${formatNumber(result.rmp.avgRating)}`,
        title: `Averages ${formatNumber(result.rmp.avgRating)} out of 5 across ${ratingCount} RateMyProfessors ${ratingCount === 1 ? "rating" : "ratings"}`,
        href: result.rmp.link,
        modifier: "rmp"
      }));
    }

    const searchChip = createRmpSearchChip(section);
    if (searchChip) {
      overlay.append(searchChip);
    }

    if (features.grades && hasGradeSource && config.showCougarGrades && (result || courseResult)) {
      overlay.append(...createCougarGradesChips(section));
    }

    const seatChip = features.seats ? createSeatChip(section) : null;
    if (seatChip) {
      overlay.append(seatChip);
    }

    if (section.isPlaceholder && !result && section.lookupSettled) {
      overlay.append(createChip({
        label: "Instructor TBA",
        title: "Instructor has not been assigned yet",
        href: courseResult?.link,
        modifier: "tba"
      }));
    }

    hostNode.replaceChildren(...(overlay.childNodes.length ? [overlay] : []));
  }

  // Instructor figures when we have them, otherwise the course-wide fallback.
  const COUGAR_GRADES_METRICS = [
    {
      key: "gpa",
      modifier: "cg",
      format: formatNumber,
      instructor: ["GPA", "Students in this instructor’s sections averaged this GPA"],
      course: ["Course GPA", "Average GPA across every instructor who teaches this course"]
    },
    {
      key: "dropRate",
      modifier: "cg-gold",
      format: formatPercent,
      instructor: ["Drop Rate", "This share of students withdrew from this instructor’s sections"],
      course: ["Course Drop Rate", "Share of students who withdraw from this course, across all instructors"]
    }
  ];

  function createCougarGradesChips(section) {
    const instructorGrades = section.result?.cougarGrades;
    const chips = COUGAR_GRADES_METRICS.flatMap((metric) => {
      const useInstructor = instructorGrades?.[metric.key] != null;
      const grades = useInstructor ? instructorGrades : section.courseResult;
      if (grades?.[metric.key] == null) {
        return [];
      }

      const [prefix, title] = useInstructor ? metric.instructor : metric.course;
      return createChip({
        label: `${prefix} ${metric.format(grades[metric.key])}`,
        title,
        href: grades.link,
        modifier: metric.modifier
      });
    });

    if (section.result && !instructorGrades && !section.isPlaceholder) {
      const unreachable = Boolean(section.result.failed?.cougarGrades);
      chips.push(createChip({
        label: unreachable ? "CG unavailable" : "No CG Data",
        title: unreachable
          ? "CougarGrades could not be reached. Reload the page later to try again."
          : "No CougarGrades instructor data was found for this professor",
        href: section.courseCode ? courseCodeLink(section.courseCode) : "",
        modifier: "tba"
      }));
    }

    return chips;
  }

  /**
   * A plain RMP search link when no rating is shown: the campus has no rating
   * lookup, the lookup failed, or it found no match. Nothing is sent until the
   * student clicks it.
   */
  function createRmpSearchChip(section) {
    if (!features.ratingsLink || !config.showRmp || !section.professorName || !section.lookupSettled) {
      return null;
    }
    const rmp = section.result?.rmp;
    if (features.ratings && rmp?.avgRating != null && rmp.numRatings > 0) {
      return null;
    }
    return createChip({
      label: "Search RMP",
      title: `Search RateMyProfessors for ${section.professorName}`,
      href: CAMPUSES.rmpSearchUrl(campus, section.professorName),
      modifier: "rmp-search"
    });
  }

  /** Plain words, not the weighted arithmetic: the inputs are what students read. */
  function describeInstructor(result) {
    const figures = [];
    if (result.rmp?.avgRating != null) {
      figures.push(`${formatNumber(result.rmp.avgRating)} rating`);
    }

    if (result.cougarGrades?.gpa != null) {
      figures.push(`${formatNumber(result.cougarGrades.gpa)} average GPA`);
    }

    if (result.cougarGrades?.dropRate != null) {
      figures.push(`${formatPercent(result.cougarGrades.dropRate)} withdraw`);
    }

    return figures.join(", ");
  }

  /**
   * Quiet nudge only when seats are genuinely scarce; never a loud warning.
   * Read from the page, so it shows before (and without) any lookup.
   */
  function createSeatChip(section) {
    if (section.waitlisted) {
      return createChip({
        label: "Waitlist",
        title: "This option is waitlisted",
        href: "",
        modifier: "seats"
      });
    }

    if (!section.seats) {
      return null;
    }

    const { open, total } = section.seats;
    if (open === 0) {
      return createChip({
        label: "Full",
        title: `No open seats remain in this option (0 of ${total})`,
        href: "",
        modifier: "seats"
      });
    }

    if (open > SEAT_PRESSURE_MAX_OPEN && (open / total) > SEAT_PRESSURE_MAX_RATIO) {
      return null;
    }

    return createChip({
      label: open === 1 ? "1 seat left" : `${open} seats left`,
      title: `${open} of ${total} seats remain in this option`,
      href: "",
      modifier: "seats"
    });
  }

  function renderCourseHeaderOverlay(anchorNode, courseCode) {
    const overlay = document.createElement("span");
    overlay.className = "prof-overlay prof-overlay--course-header";
    overlay.addEventListener("click", stopRowNavigation);
    overlay.append(createChip({
      label: `CG ${courseCode}`,
      title: `View ${courseCode} on CougarGrades`,
      href: courseCodeLink(courseCode),
      modifier: "cg-course"
    }));

    anchorNode.insertAdjacentElement("afterend", overlay);
    return overlay;
  }

  /** Anchors carry their own target/rel; chips without a destination are inert. */
  function createChip({ label, title, href, modifier }) {
    const chip = document.createElement(href ? "a" : "span");
    chip.className = `prof-overlay__chip prof-overlay__chip--${modifier}`;
    chip.textContent = label;
    chip.title = title;

    if (href) {
      chip.href = href;
      chip.target = "_blank";
      chip.rel = "noopener noreferrer";
    }

    return chip;
  }

  function ensureOverlayHost(section) {
    const { anchorNode, hostNode } = section;
    if (!anchorNode.isConnected) {
      return null;
    }

    if (hostNode?.isConnected && hostNode.previousElementSibling === anchorNode) {
      return hostNode;
    }

    const host = hostNode || createOverlayHost();
    releaseHeightClamps(section);
    anchorNode.insertAdjacentElement("afterend", host);
    section.hostNode = host;
    return host;
  }

  /** The badge reads as the row's verdict, not as one more data pill. */
  function highlightRow(section, isBest) {
    const { row } = section;
    if (!row) return;
    const hasWinningInstructor = isBest || [...sectionsByAnchorNode.values()].some((other) =>
      other !== section && other.result && other.row === row && isBestProfessor(other));
    row.classList.toggle("prof-overlay-best-row", hasWinningInstructor);
  }

  /**
   * PeopleSoft pins sub-row heights so the Class and Instructor columns line up.
   * A pinned box cannot grow, so a lecture's chips paint over the lab beneath it.
   * Keeping the pinned height as a floor preserves the alignment while letting
   * the box grow when the chips genuinely need more room.
   */
  function releaseHeightClamps({ anchorNode, row }) {
    if (!row) return;
    for (let node = anchorNode.parentElement; node && node !== row; node = node.parentElement) {
      if (node.classList.contains("prof-overlay-unclamped")) {
        continue;
      }

      const pinnedHeight = node.getBoundingClientRect().height;
      node.classList.add("prof-overlay-unclamped");
      node.style.minHeight = `${pinnedHeight}px`;
    }
  }

  function createOverlayHost() {
    const host = document.createElement("span");
    host.className = "prof-overlay-host";
    // One delegated listener per host instead of one per chip.
    host.addEventListener("click", stopRowNavigation);
    return host;
  }

  function stopRowNavigation(event) {
    event.stopPropagation();
  }

  function clearAllOverlays() {
    sectionsByAnchorNode.forEach((section) => {
      section.row?.classList.remove("prof-overlay-best-row");
      section.hostNode?.remove();
    });
    sectionsByAnchorNode.clear();
    anchorNodesByCourseCode.clear();
    rankingsByCourseCode.clear();
    inFlightLookups.clear();
    instructorClaimsByRow = new WeakMap();
    courseOverlays.forEach(({ overlay }) => overlay.remove());
    courseOverlays.clear();
    document.querySelectorAll(".prof-overlay-host").forEach((host) => host.remove());
  }

  function applyChangedSettings(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    Object.entries(changes).forEach(([key, change]) => {
      if (key in DEFAULT_CONFIG) config[key] = change.newValue ?? DEFAULT_CONFIG[key];
    });
    validateConfig();

    if (changes.campuses) {
      const nowActive = isCampusEnabled(changes.campuses.newValue);
      if (nowActive !== active) {
        active = nowActive;
        publishCampusState();
        stopObserving();
        clearAllOverlays();
        if (active) {
          warnedAboutRejection = false;
          scanPage();
          observePage();
        }
        return;
      }
    }

    if (!active) {
      return;
    }

    if (Object.keys(changes).some((key) => LOOKUP_SETTINGS.has(key))) {
      observer.disconnect();
      clearAllOverlays();
      scanPage();
      observePage();
      return;
    }

    if (changes.defaultScoringMode) rebuildRankings();
  }

  function rebuildRankings() {
    rankingsByCourseCode.clear();
    sectionsByAnchorNode.forEach(updateBestProfessor);
    sectionsByAnchorNode.forEach(renderOverlay);
  }

  function validateConfig() {
    if (!SCORING_MODES[config.defaultScoringMode]) {
      config.defaultScoringMode = DEFAULT_CONFIG.defaultScoringMode;
    }
    for (const key of SELECTOR_KEYS) {
      try {
        if (typeof config[key] !== "string" || !config[key].trim()) throw new Error("Empty selector");
        document.querySelector(config[key]);
      } catch {
        config[key] = DEFAULT_CONFIG[key];
      }
    }
  }

  function getProfessorKey(section) {
    return normalizeWhitespace(section.result?.name || section.professorName).toLowerCase();
  }

  function courseCodeLink(courseCode) {
    return `${config.cougarGradesBaseUrl}/c/${encodeURIComponent(courseCode)}`;
  }
})();
