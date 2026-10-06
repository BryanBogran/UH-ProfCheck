(async function initProfessorOverlay() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const DEFAULT_CONFIG = globalThis.PROFCHECK_DEFAULTS;
  const { SCORING_MODES, computeScore, pickBadgedProfessors } = globalThis.PROFCHECK_SCORING;
  const {
    normalizeWhitespace, isPlaceholderInstructor, extractProfessorName,
    extractCourseCode, formatNumber, formatPercent
  } = globalThis.PROFCHECK_PARSE;

  const OPEN_SEATS_PATTERN = /Open Seats (\d+) of (\d+)/g;
  const SEAT_PRESSURE_MAX_OPEN = 5;
  const SEAT_PRESSURE_MAX_RATIO = 0.1;
  const NO_BADGED_PROFESSORS = new Set();
  const LOOKUP_SETTINGS = new Set([
    "showRmp", "showCougarGrades", "universityName", "rmpStrictSearch",
    "cougarGradesApiBaseUrl", "cougarGradesBaseUrl", "rmpProfessorBaseUrl",
    "courseRowSelector", "instructorSelector", "courseCodeSelector"
  ]);

  const config = {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };

  validateConfig();

  // Section state is keyed by its instructor node and pruned once that node
  // detaches, so PeopleSoft postbacks cannot pile up detached DOM.
  const sectionsByAnchorNode = new Map();
  const anchorNodesByCourseCode = new Map();
  const rankingsByCourseCode = new Map();
  const inFlightLookups = new Map();
  const courseOverlays = new Map();
  let instructorClaimsByRow = new WeakMap();

  const observer = new MutationObserver(handlePageMutations);
  let queuedScanFrame = 0;

  scanPage();
  observePage();

  window.addEventListener("pagehide", stopObserving, { once: true });
  extensionApi.storage.onChanged.addListener(applyChangedSettings);

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

  function scanPage() {
    pruneDetachedSections();
    removeOrphanedHosts();
    courseOverlays.forEach(({ overlay }, node) => {
      if (!node.isConnected || !node.matches(config.courseCodeSelector)) {
        overlay.remove();
        courseOverlays.delete(node);
      }
    });

    document.querySelectorAll(config.courseCodeSelector).forEach(processCourseNode);
    document.querySelectorAll(config.instructorSelector).forEach(processInstructorNode);

    // Rows without an instructor element still carry a "TBA"/"Staff" text cell.
    document.querySelectorAll(config.courseRowSelector).forEach((row) => {
      if (row.querySelector(config.instructorSelector)) {
        return;
      }

      const placeholderNode = findPlaceholderInstructorNode(row);
      if (placeholderNode) {
        processInstructorNode(placeholderNode);
      }
    });

    rebuildRankings();
  }

  function pruneDetachedSections() {
    sectionsByAnchorNode.forEach((section, anchorNode) => {
      if (anchorNode.isConnected
        && normalizeWhitespace(anchorNode.textContent) === section.instructorText
        && extractRowCourseCode(anchorNode) === section.courseCode) {
        return;
      }

      const claims = instructorClaimsByRow.get(anchorNode.closest(config.courseRowSelector));
      const claimKey = section.professorName.toLowerCase() || `tba::${section.courseCode}`;
      if (claims?.get(claimKey) === anchorNode) claims.delete(claimKey);
      sectionsByAnchorNode.delete(anchorNode);
      anchorNodesByCourseCode.get(section.courseCode)?.delete(anchorNode);
      highlightRow(section, false);
      section.hostNode?.remove();
    });
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

  function processCourseNode(node) {
    if (!isCourseHeaderNode(node)) {
      return;
    }

    const courseCode = extractCourseCode(node.textContent);
    const existing = courseOverlays.get(node);
    if (config.showCougarGrades && courseCode
      && existing?.courseCode === courseCode && existing.overlay.isConnected) return;
    existing?.overlay.remove();
    courseOverlays.delete(node);
    if (config.showCougarGrades && courseCode) {
      courseOverlays.set(node, { courseCode, overlay: renderCourseHeaderOverlay(node, courseCode) });
    }
  }

  async function processInstructorNode(node) {
    if (sectionsByAnchorNode.has(node)) {
      return;
    }

    // instructorSelector matches on an id substring, so PeopleSoft's wrapper span
    // matches alongside the name span inside it. The innermost node owns the
    // chips; an ancestor would render them away from the name it describes.
    if (node.querySelector(config.instructorSelector)) {
      return;
    }

    // Only an explicit "TBA"/"Staff" cell is a placeholder; an unparseable name
    // is just a cell we cannot use yet.
    const isPlaceholder = isPlaceholderInstructor(node.textContent);
    const professorName = isPlaceholder ? "" : extractProfessorName(node.textContent);
    if (!isPlaceholder && !professorName) {
      return;
    }

    const courseCode = extractRowCourseCode(node);
    if (isPlaceholder && !courseCode) {
      return;
    }

    if (!claimInstructorInRow(node, professorName.toLowerCase() || `tba::${courseCode}`)) {
      return;
    }

    const section = {
      anchorNode: node,
      hostNode: null,
      courseCode,
      professorName,
      instructorText: normalizeWhitespace(node.textContent),
      result: null,
      courseResult: null,
      isPlaceholder
    };

    sectionsByAnchorNode.set(node, section);
    getOrCreate(anchorNodesByCourseCode, courseCode, () => new Set()).add(node);

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
      if (!response?.ok || !response.result || sectionsByAnchorNode.get(node) !== section) {
        return;
      }

      if (professorName) {
        section.result = response.result;
      } else {
        section.courseResult = response.result;
      }

      renderSectionAndBadge(section);
    } catch (error) {
      console.error("Unable to render section overlay", error);
    }
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
  function claimInstructorInRow(node, claimKey) {
    const row = node.closest(config.courseRowSelector);
    if (!row) {
      return true;
    }

    const claims = getOrCreate(instructorClaimsByRow, row, () => new Map());

    // A claim held by a node the page has since replaced is stale, not a conflict.
    const holder = claims.get(claimKey);
    if (holder && holder !== node && holder.isConnected) {
      return false;
    }

    claims.set(claimKey, node);
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
    if (!professorKey || !section.courseCode || !section.result) {
      return;
    }

    // Counted as a rival even when unscored, so "best of one" never gets a badge.
    const ranking = getOrCreate(rankingsByCourseCode, section.courseCode, () => (
      { professorKeys: new Set(), scoresByProfessorKey: new Map(), badgedKeys: null }
    ));
    ranking.professorKeys.add(professorKey);

    const score = computeScore({
      rmp: config.showRmp ? section.result.rmp : null,
      cougarGrades: config.showCougarGrades ? section.result.cougarGrades : null
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
    const { result, courseResult } = section;
    if (!hostNode || (!result && !courseResult)) {
      return;
    }

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

    if (config.showRmp && result?.rmp?.avgRating != null && result.rmp.numRatings > 0) {
      const ratingCount = result.rmp.numRatings;
      overlay.append(createChip({
        label: `Rating ${formatNumber(result.rmp.avgRating)}`,
        title: `Averages ${formatNumber(result.rmp.avgRating)} out of 5 across ${ratingCount} RateMyProfessors ${ratingCount === 1 ? "rating" : "ratings"}`,
        href: result.rmp.link,
        modifier: "rmp"
      }));
    }

    if (config.showCougarGrades) {
      overlay.append(...createCougarGradesChips(section));
    }

    const seatChip = createSeatPressureChip(section);
    if (seatChip) {
      overlay.append(seatChip);
    }

    if (section.isPlaceholder && !result) {
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
      instructor: ["GPA", "Students in this instructor\u2019s sections averaged this GPA"],
      course: ["Course GPA", "Average GPA across every instructor who teaches this course"]
    },
    {
      key: "dropRate",
      modifier: "cg-gold",
      format: formatPercent,
      instructor: ["Drop Rate", "This share of students withdrew from this instructor\u2019s sections"],
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
      chips.push(createChip({
        label: "No CG Data",
        title: "No CougarGrades instructor data was found for this professor",
        href: section.courseCode ? courseCodeLink(section.courseCode) : "",
        modifier: "tba"
      }));
    }

    return chips;
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

  /** Quiet nudge only when seats are genuinely scarce; never a loud warning. */
  function createSeatPressureChip(section) {
    const row = section.anchorNode.closest(config.courseRowSelector);
    if (!row) {
      return null;
    }

    let tightest = null;
    for (const match of row.textContent.matchAll(OPEN_SEATS_PATTERN)) {
      const openSeats = Number(match[1]);
      const totalSeats = Number(match[2]);
      if (totalSeats && (!tightest || openSeats < tightest.openSeats)) {
        tightest = { openSeats, totalSeats };
      }
    }

    if (!tightest) {
      return null;
    }

    const { openSeats, totalSeats } = tightest;
    if (openSeats > SEAT_PRESSURE_MAX_OPEN && (openSeats / totalSeats) > SEAT_PRESSURE_MAX_RATIO) {
      return null;
    }

    return createChip({
      label: openSeats === 1 ? "1 seat left" : `${openSeats} seats left`,
      title: `${openSeats} of ${totalSeats} seats remain in this option`,
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
    releaseHeightClamps(anchorNode);
    anchorNode.insertAdjacentElement("afterend", host);
    section.hostNode = host;
    return host;
  }

  /** The badge reads as the row's verdict, not as one more data pill. */
  function highlightRow(section, isBest) {
    const row = section.anchorNode.closest(config.courseRowSelector);
    if (!row) return;
    const hasWinningInstructor = isBest || [...sectionsByAnchorNode.values()].some((other) =>
      other !== section && other.result && isBestProfessor(other)
      && other.anchorNode.closest(config.courseRowSelector) === row);
    row.classList.toggle("prof-overlay-best-row", hasWinningInstructor);
  }

  /**
   * PeopleSoft pins sub-row heights so the Class and Instructor columns line up.
   * A pinned box cannot grow, so a lecture's chips paint over the lab beneath it.
   * Keeping the pinned height as a floor preserves the alignment while letting
   * the box grow when the chips genuinely need more room.
   */
  function releaseHeightClamps(anchorNode) {
    const row = anchorNode.closest(config.courseRowSelector);
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

  function applyChangedSettings(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    Object.entries(changes).forEach(([key, change]) => {
      if (key in DEFAULT_CONFIG) config[key] = change.newValue ?? DEFAULT_CONFIG[key];
    });
    validateConfig();

    if (Object.keys(changes).some((key) => LOOKUP_SETTINGS.has(key))) {
      observer.disconnect();
      sectionsByAnchorNode.forEach((section) => {
        section.anchorNode.closest(config.courseRowSelector)?.classList.remove("prof-overlay-best-row");
        section.hostNode?.remove();
      });
      sectionsByAnchorNode.clear();
      anchorNodesByCourseCode.clear();
      rankingsByCourseCode.clear();
      inFlightLookups.clear();
      instructorClaimsByRow = new WeakMap();
      courseOverlays.forEach(({ overlay }) => overlay.remove());
      courseOverlays.clear();
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
    for (const key of ["courseRowSelector", "instructorSelector", "courseCodeSelector"]) {
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


  /** Innermost match wins: a nested cell is more specific than its container. */
  function findPlaceholderInstructorNode(row) {
    const candidates = row.querySelectorAll("td, span, div");
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      if (isPlaceholderInstructor(candidates[index].textContent)) {
        return candidates[index];
      }
    }

    return null;
  }


  /** Course-detail tables keep their single course header above the rows. */
  function extractRowCourseCode(node) {
    const row = node.closest(config.courseRowSelector);
    const courseCodeNode = row?.querySelector(config.courseCodeSelector);
    if (courseCodeNode) return extractCourseCode(courseCodeNode.textContent);
    for (let parent = row?.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const codes = new Set([...parent.querySelectorAll(config.courseCodeSelector)]
        .filter(isCourseHeaderNode)
        .map((header) => extractCourseCode(header.textContent)).filter(Boolean));
      if (codes.size === 1) return [...codes][0];
      if (codes.size > 1) break;
    }
    return "";
  }


  function courseCodeLink(courseCode) {
    return `${config.cougarGradesBaseUrl}/c/${encodeURIComponent(courseCode)}`;
  }

  function isCourseHeaderNode(node) {
    return !node.closest("tr, table, [role='row'], .ps_grid-row");
  }



})();
