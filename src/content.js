(async function initProfessorOverlay() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const DEFAULT_CONFIG = {
    enabledUrlPatterns: [
      "https://saprd.my.uh.edu/*"
    ],
    courseRowSelector: "[data-course-row], tr, .course-row, .class-row",
    instructorSelector: "span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name",
    courseCodeSelector: "span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog",
    showRmp: true,
    showCougarGrades: true,
    enableDarkMode: false,
    defaultScoringMode: "balanced"
  };

  const SCORING_MODES = {
    balanced: {
      label: "Best Overall"
    },
    easiestA: {
      label: "Easiest A"
    },
    lowestRisk: {
      label: "Lowest Risk"
    }
  };

  const config = {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };

  if (!SCORING_MODES[config.defaultScoringMode]) {
    config.defaultScoringMode = "balanced";
  }

  if (!isEnabledForCurrentPage(config.enabledUrlPatterns)) {
    return;
  }

  const renderedNodes = new WeakSet();
  const renderedCourseNodes = new WeakSet();
  const pendingLookups = new Map();
  const pendingCourseLookups = new Map();
  const bestProfessorNameByCourse = new Map();
  const shownNonLabByCourse = new Map();

  applyPageTheme();
  scanPage();
  window.addEventListener("load", () => scanPage(), { once: true });
  setTimeout(scanPage, 250);
  setTimeout(scanPage, 900);

  const observer = new MutationObserver(() => {
    applyPageTheme();
    scanPage();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  function applyPageTheme() {
    document.documentElement.classList.toggle("prof-accessuh-dark", Boolean(config.enableDarkMode));
    if (document.body) {
      document.body.classList.toggle("prof-accessuh-dark", Boolean(config.enableDarkMode));
    }
  }

  function scanPage() {
    removeLegacyOverlays();

    document.querySelectorAll(config.courseCodeSelector).forEach((node) => {
      processCourseNode(node);
    });

    const rows = document.querySelectorAll(config.courseRowSelector);
    if (rows.length) {
      rows.forEach((row) => {
        row.querySelectorAll(config.instructorSelector).forEach((node) => {
          processInstructorNode(node);
        });

        const placeholderNode = findPlaceholderInstructorNode(row);
        if (placeholderNode) {
          processInstructorNode(placeholderNode);
        }
      });
    }

    document.querySelectorAll(config.instructorSelector).forEach((node) => {
      processInstructorNode(node);
    });

    // Hide lab overlays for lecture+lab combinations
    const overlayGroups = new Map();
    document.querySelectorAll('.prof-overlay[data-professor-course]').forEach((overlay) => {
      const key = overlay.dataset.professorCourse;
      if (!overlayGroups.has(key)) {
        overlayGroups.set(key, []);
      }
      overlayGroups.get(key).push(overlay);
    });

    overlayGroups.forEach((overlays) => {
      const labOverlays = [];
      const nonLabOverlays = [];

      overlays.forEach((overlay) => {
        const row = overlay.closest(config.courseRowSelector);
        if (!row) {
          nonLabOverlays.push(overlay);
          return;
        }

        const courseCodeElement = row.querySelector(config.courseCodeSelector);
        let isLab = false;

        if (courseCodeElement) {
          const courseText = normalizeWhitespace(courseCodeElement.textContent || "").toUpperCase();
          if (courseText.includes('LAB') || courseText.includes(' L ')) {
            isLab = true;
          }
        }

        if (!isLab) {
          const rowText = normalizeWhitespace(row.textContent || "").toLowerCase();
          if (/\blab\b|\blaboratory\b|\bpract\b|\bpractice\b/.test(rowText)) {
            isLab = true;
          }
        }

        if (isLab) {
          labOverlays.push(overlay);
        } else {
          nonLabOverlays.push(overlay);
        }
      });

      // If we have >=1 non-lab overlay for this professor+course, hide all lab overlays.
      if (nonLabOverlays.length > 0) {
        labOverlays.forEach((overlay) => {
          overlay.style.display = 'none';
        });
      }
    });
  }

  function processCourseNode(node) {
    if (renderedCourseNodes.has(node) || !isCourseHeaderNode(node)) {
      return;
    }

    const courseCode = extractCourseCode(node);
    if (!courseCode) {
      return;
    }

    renderedCourseNodes.add(node);
    renderCourseOverlay(node, courseCode);
  }

  async function processInstructorNode(node) {
    if (renderedNodes.has(node) || !isUsableInstructorNode(node)) {
      return;
    }

    const isPlaceholder = isExactPlaceholderInstructor(node?.textContent || "");
    const professorName = isPlaceholder ? "" : extractProfessorName(node);
    const courseCode = extractCourseCode(node);
    const row = node.closest(config.courseRowSelector);

    if (!isPlaceholder && !professorName) {
      return;
    }

    if (isPlaceholder && row?.querySelector(".prof-overlay[data-overlay-type='placeholder']")) {
      renderedNodes.add(node);
      return;
    }

    if (!isPlaceholder && hasOverlaySibling(node)) {
      renderedNodes.add(node);
      return;
    }

    renderedNodes.add(node);

    if (isPlaceholder) {
      if (!courseCode) {
        return;
      }

      if (!pendingCourseLookups.has(courseCode)) {
        pendingCourseLookups.set(
          courseCode,
          extensionApi.runtime.sendMessage({
            type: "LOOKUP_COURSE",
            payload: { courseCode }
          })
        );
      }

      try {
        const response = await pendingCourseLookups.get(courseCode);
        if (!response?.ok || !response.result) {
          return;
        }

        renderOverlay(node, {
          result: null,
          courseResult: response.result,
          courseCode,
          isPlaceholder: true,
          professorName: ""
        });
      } catch (error) {
        console.error("Unable to render placeholder instructor overlay", error);
      }

      return;
    }

    const cacheKey = `${professorName.toLowerCase()}::${courseCode}`;
    if (!pendingLookups.has(cacheKey)) {
      pendingLookups.set(
        cacheKey,
        extensionApi.runtime.sendMessage({
          type: "LOOKUP_PROFESSOR",
          payload: { professorName, courseCode }
        })
      );
    }

    try {
      const response = await pendingLookups.get(cacheKey);
      if (!response?.ok || !response.result) {
        return;
      }

      const normalizedCourseCode = courseCode || response.result.courseCode || "";
      const candidateScore = computeProfessorScore(response.result, config.defaultScoringMode);
      let isBest = false;

      if (normalizedCourseCode && candidateScore != null) {
        const currentBest = bestProfessorNameByCourse.get(normalizedCourseCode);
        if (!currentBest || candidateScore > currentBest.score) {
          bestProfessorNameByCourse.set(normalizedCourseCode, {
            name: professorName,
            score: candidateScore
          });
          isBest = true;
        } else if (currentBest.name === professorName) {
          isBest = true;
        }
      }

      renderOverlay(node, {
        result: response.result,
        courseResult: null,
        courseCode: normalizedCourseCode,
        isPlaceholder: false,
        isBest,
        professorName
      });
    } catch (error) {
      console.error("Unable to render professor overlay", error);
    }
  }

  function computeProfessorScore(result, mode) {
    if (!result) {
      return null;
    }

    const rawRating = Number(result.rmp?.avgRating);
    const rawGpa = Number(result.cougarGrades?.gpa);
    const rawDrop = Number(result.cougarGrades?.dropRate);

    const rmpScore = Number.isFinite(rawRating) ? rawRating / 5 : null;
    const gpaScore = Number.isFinite(rawGpa) ? rawGpa / 4 : null;
    const dropScore = Number.isFinite(rawDrop) ? 1 - rawDrop / 100 : null;

    switch (mode) {
      case "easiestA":
        return gpaScore != null ? gpaScore : rmpScore;
      case "lowestRisk":
        return dropScore != null ? dropScore : gpaScore != null ? gpaScore : rmpScore;
      case "balanced":
      default:
        if (gpaScore != null && rmpScore != null) {
          return (gpaScore + rmpScore + (dropScore != null ? dropScore : 0.5)) / (dropScore != null ? 3 : 2);
        }
        if (gpaScore != null) {
          return gpaScore;
        }
        if (rmpScore != null) {
          return rmpScore;
        }
        return dropScore;
    }
  }

  function renderOverlay(anchorNode, { result, courseResult, courseCode, isPlaceholder, isBest = false, professorName }) {
    if (!anchorNode?.isConnected || (!result && !courseResult)) {
      return;
    }

    const shouldStackOverlay = !isPlaceholder && Boolean(result);
    const host = getOrCreateOverlayHost(anchorNode, shouldStackOverlay);
    const existingOverlay = host.querySelector(":scope > .prof-overlay");
    const overlay = existingOverlay || document.createElement("div");
    overlay.className = "prof-overlay";
    overlay.dataset.overlayType = isPlaceholder ? "placeholder" : "professor";
    overlay.dataset.professorCourse = `${courseCode}::${professorName}`;
    overlay.replaceChildren();

    if (result && isBest) {
      overlay.appendChild(
        createChip({
          label: SCORING_MODES[config.defaultScoringMode].label,
          title: `Best option for ${courseCode || "this course"} using ${SCORING_MODES[config.defaultScoringMode].label} scoring`,
          href: result.cougarGrades?.link || result.rmp?.link,
          modifier: "best"
        })
      );
    }

    if (config.showRmp && result?.rmp?.avgRating != null) {
      overlay.appendChild(
        createChip({
          label: `Rating ${formatNumber(result.rmp.avgRating)}`,
          title: `${result.rmp.numRatings || 0} ratings`,
          href: result.rmp.link,
          modifier: "rmp"
        })
      );
    }

    if (config.showCougarGrades && result?.cougarGrades?.gpa != null) {
      overlay.appendChild(
        createChip({
          label: `GPA ${formatNumber(result.cougarGrades.gpa)}`,
          title: "CougarGrades average GPA",
          href: result.cougarGrades.link,
          modifier: "cg"
        })
      );
    } else if (config.showCougarGrades && courseResult?.gpa != null) {
      overlay.appendChild(
        createChip({
          label: `Course GPA ${formatNumber(courseResult.gpa)}`,
          title: "Course average GPA from CougarGrades",
          href: courseResult.link,
          modifier: "cg"
        })
      );
    }

    if (config.showCougarGrades && result?.cougarGrades?.dropRate != null) {
      overlay.appendChild(
        createChip({
          label: `Drop Rate ${formatPercent(result.cougarGrades.dropRate)}`,
          title: "CougarGrades withdrawal rate",
          href: result.cougarGrades.link,
          modifier: "cg-gold"
        })
      );
    } else if (config.showCougarGrades && courseResult?.dropRate != null) {
      overlay.appendChild(
        createChip({
          label: `Course Drop Rate ${formatPercent(courseResult.dropRate)}`,
          title: "Course withdrawal rate from CougarGrades",
          href: courseResult.link,
          modifier: "cg-gold"
        })
      );
    }

    if (
      config.showCougarGrades &&
      result &&
      !result.cougarGrades &&
      !isPlaceholder
    ) {
      overlay.appendChild(
        createChip({
          label: "No GPA Data",
          title: "No CougarGrades instructor data was found for this professor",
          href: courseCode
            ? `https://cougargrades.io/c/${encodeURIComponent(courseCode)}`
            : "",
          modifier: "tba"
        })
      );
    }

    if (!result && isPlaceholder) {
      overlay.appendChild(
        createChip({
          label: "Instructor TBA",
          title: "Instructor has not been assigned yet",
          href: courseResult?.link,
          modifier: "tba"
        })
      );
    }

    if (!overlay.childNodes.length) {
      return;
    }

    if (!existingOverlay) {
      host.appendChild(overlay);
    }
  }

  function renderCourseOverlay(anchorNode, courseCode) {
    if (anchorNode.parentElement?.querySelector(":scope > .prof-overlay-course-link")) {
      return;
    }

    const courseLink = document.createElement("a");
    courseLink.className = "prof-overlay-course-link";
    courseLink.href = `https://cougargrades.io/c/${encodeURIComponent(courseCode)}`;
    courseLink.target = "_blank";
    courseLink.rel = "noopener noreferrer";
    courseLink.textContent = `Course stats for ${courseCode}`;
    courseLink.title = `View ${courseCode} on CougarGrades`;

    courseLink.addEventListener("pointerdown", (event) => event.stopPropagation());
    courseLink.addEventListener("mousedown", (event) => event.stopPropagation());
    courseLink.addEventListener("mouseup", (event) => event.stopPropagation());
    courseLink.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.open(courseLink.href, "_blank", "noopener,noreferrer");
    });

    anchorNode.insertAdjacentElement("afterend", courseLink);
  }

  function removeLegacyOverlays() {
    document.querySelectorAll(".prof-overlay--course-header").forEach((node) => node.remove());

    document.querySelectorAll(".prof-overlay").forEach((overlay) => {
      const legacyChips = [...overlay.querySelectorAll(".prof-overlay__chip")]
        .filter((chip) => isLegacyChipLabel(normalizeWhitespace(chip.textContent || "")));

      legacyChips.forEach((chip) => chip.remove());

      if (!overlay.querySelector(".prof-overlay__chip")) {
        overlay.remove();
      }
    });

    document.querySelectorAll(`${config.courseRowSelector} .prof-overlay[data-overlay-type='placeholder']`).forEach((overlay) => {
      const row = overlay.closest(config.courseRowSelector);
      if (!row) {
        return;
      }

      const placeholders = [...row.querySelectorAll(".prof-overlay[data-overlay-type='placeholder']")];
      placeholders.slice(1).forEach((duplicate) => duplicate.parentElement?.remove());
    });
  }

  function isLegacyChipLabel(label) {
    if (!label) {
      return false;
    }

    return (
      /^RMP\s+\d/.test(label) ||
      /^CG Prof$/i.test(label) ||
      /^CG\s+[A-Z]{2,5}\s?\d{4}$/i.test(label) ||
      /^CG\s+[\d.]+\s+GPA$/i.test(label) ||
      /^CG\s+[\d.]+%\s+[A-Z]$/i.test(label)
    );
  }

  function createChip({ label, title, href, modifier }) {
    const link = document.createElement("a");
    link.className = `prof-overlay__chip prof-overlay__chip--${modifier}`;
    link.href = href || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    link.title = title;

    const stopRowClick = (event) => {
      event.stopPropagation();
    };

    const openWithoutRowNavigation = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    };

    link.addEventListener("pointerdown", stopRowClick);
    link.addEventListener("mousedown", stopRowClick);
    link.addEventListener("mouseup", stopRowClick);
    link.addEventListener("click", openWithoutRowNavigation);
    return link;
  }

  function hasOverlaySibling(node) {
    return Boolean(
      node.nextElementSibling?.classList?.contains("prof-overlay-host") ||
      node.parentElement?.classList?.contains("prof-overlay-anchor") ||
      node.querySelector?.(":scope > .prof-overlay-host")
    );
  }

  function getOrCreateOverlayHost(anchorNode, shouldWrapAnchor) {
    if (anchorNode.matches("td, th")) {
      const existingHost = anchorNode.querySelector(":scope > .prof-overlay-host");
      if (existingHost) {
        return existingHost;
      }

      const host = document.createElement("div");
      host.className = "prof-overlay-host";
      anchorNode.appendChild(host);
      return host;
    }

    if (shouldWrapAnchor) {
      const existingAnchor = anchorNode.parentElement?.classList?.contains("prof-overlay-anchor")
        ? anchorNode.parentElement
        : null;
      const anchor = existingAnchor || wrapAnchorNode(anchorNode);
      const existingHost = anchor.querySelector(":scope > .prof-overlay-host");
      if (existingHost) {
        return existingHost;
      }

      const host = document.createElement("div");
      host.className = "prof-overlay-host";
      anchor.appendChild(host);
      return host;
    }

    const nextSibling = anchorNode.nextElementSibling;
    if (nextSibling?.classList?.contains("prof-overlay-host")) {
      return nextSibling;
    }

    const host = document.createElement("div");
    host.className = "prof-overlay-host";
    anchorNode.insertAdjacentElement("afterend", host);
    return host;
  }

  function wrapAnchorNode(anchorNode) {
    const wrapper = document.createElement("span");
    wrapper.className = "prof-overlay-anchor";
    anchorNode.insertAdjacentElement("beforebegin", wrapper);
    wrapper.appendChild(anchorNode);
    return wrapper;
  }

  function isPlaceholderInstructor(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    return Boolean(normalized) && /(to be announced|tba|staff)/.test(normalized);
  }

  function findPlaceholderInstructorNode(row) {
    const instructorCandidates = [...row.querySelectorAll(config.instructorSelector)]
      .filter((node) => isUsableInstructorNode(node))
      .filter((node) => isExactPlaceholderInstructor(node?.textContent || ""));

    if (instructorCandidates.length) {
      return instructorCandidates[0];
    }

    return null;
  }

  function isExactPlaceholderInstructor(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    return normalized === "to be announced" || normalized === "tba" || normalized === "staff";
  }

  function extractProfessorName(node) {
    const text = normalizeWhitespace(node?.textContent || "");
    if (!text) {
      return "";
    }

    return text
      .split(/\s{2,}|\/|;|\|/)
      .map((segment) => segment.trim())
      .find((segment) => /^[A-Za-z ,.'-]{4,}$/.test(segment)) || "";
  }

  function isUsableInstructorNode(node) {
    if (!node?.isConnected) {
      return false;
    }

    if (node.closest(".prof-overlay")) {
      return false;
    }

    const text = normalizeWhitespace(node.textContent || "");
    if (!text) {
      return false;
    }

    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    return node.getClientRects().length > 0;
  }

  function extractCourseCode(node) {
    const row = node.closest(config.courseRowSelector);
    const scopedMatch = row?.querySelector(config.courseCodeSelector);
    const directMatch = scopedMatch || document.querySelector(config.courseCodeSelector);
    const text = normalizeWhitespace(directMatch?.textContent || "").toUpperCase();
    const match = text.match(/\b([A-Z]{2,5}\s*\d{3,4})\b/);
    return match ? match[1].replace(/\s+/, " ") : "";
  }

  function isCourseHeaderNode(node) {
    return !node.closest("tr, table, [role='row'], .ps_grid-row");
  }

  function isEnabledForCurrentPage(patterns) {
    return (patterns || []).some((pattern) => wildcardToRegExp(pattern).test(window.location.href));
  }

  function isLabRow(node) {
    const row = node.closest(config.courseRowSelector);
    if (!row) {
      return false;
    }
    const courseCodeElement = row.querySelector(config.courseCodeSelector);
    if (courseCodeElement) {
      const courseText = normalizeWhitespace(courseCodeElement.textContent || "").toUpperCase();
      if (courseText.includes('LAB') || courseText.includes(' L ')) {
        return true;
      }
    }
    const rowText = normalizeWhitespace(row.textContent || "").toLowerCase();
    return /\blab\b|\blaboratory\b|\bpract\b|\bpractice\b/.test(rowText);
  }

  function wildcardToRegExp(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  }

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function formatNumber(value) {
    if (!Number.isFinite(Number(value))) {
      return "N/A";
    }

    return Number(value).toFixed(1);
  }

  function formatPercent(value) {
    if (!Number.isFinite(Number(value))) {
      return "N/A";
    }

    return `${Number(value).toFixed(1)}%`;
  }
})();
