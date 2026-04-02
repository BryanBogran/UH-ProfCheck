(async function initProfessorOverlay() {
  const DEFAULT_CONFIG = {
    enabledUrlPatterns: [
      "https://saprd.my.uh.edu/*"
    ],
    courseRowSelector: "[data-course-row], tr, .course-row, .class-row",
    instructorSelector: "span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name",
    courseCodeSelector: "span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog",
    showRmp: true,
    showCougarGrades: true
  };

  const config = {
    ...DEFAULT_CONFIG,
    ...(await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };

  if (!isEnabledForCurrentPage(config.enabledUrlPatterns)) {
    return;
  }

  const renderedNodes = new WeakSet();
  const renderedCourseNodes = new WeakSet();
  const pendingLookups = new Map();

  scanPage();

  const observer = new MutationObserver(() => {
    scanPage();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  function scanPage() {
    const directCourseNodes = document.querySelectorAll(config.courseCodeSelector);
    directCourseNodes.forEach((node) => processCourseNode(node));

    const rows = document.querySelectorAll(config.courseRowSelector);
    if (rows.length) {
      rows.forEach((row) => {
        const instructorNodes = row.querySelectorAll(config.instructorSelector);
        instructorNodes.forEach((node) => processInstructorNode(node));
      });
    }

    const directInstructorNodes = document.querySelectorAll(config.instructorSelector);
    directInstructorNodes.forEach((node) => processInstructorNode(node));
  }

  function processCourseNode(node) {
    if (renderedCourseNodes.has(node)) {
      return;
    }

    if (!isCourseHeaderNode(node)) {
      return;
    }

    const courseCode = extractCourseCode(node, config.courseCodeSelector);
    if (!courseCode) {
      return;
    }

    renderedCourseNodes.add(node);
    renderCourseOverlay(node, courseCode);
  }

  async function processInstructorNode(node) {
    if (renderedNodes.has(node)) {
      return;
    }

    const professorName = extractProfessorName(node);
    if (!professorName) {
      return;
    }

    renderedNodes.add(node);

    const cacheKey = professorName.toLowerCase();
    if (!pendingLookups.has(cacheKey)) {
      const courseCode = extractCourseCode(node, config.courseCodeSelector);
      pendingLookups.set(
        cacheKey,
        chrome.runtime.sendMessage({
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

      renderOverlay(node, response.result, config);
    } catch (error) {
      console.error("Unable to render professor overlay", error);
    }
  }

  function renderOverlay(anchorNode, result, pageConfig) {
    const instructorCell = anchorNode.closest("td, .ps_grid-cell, .ps_box-group") || anchorNode.parentElement;
    if (!instructorCell) {
      return;
    }

    const existingHost =
      anchorNode.nextElementSibling?.classList?.contains("prof-overlay-host")
        ? anchorNode.nextElementSibling
        : null;

    const staleHosts = [...instructorCell.querySelectorAll(".prof-overlay-host")].filter((host) => host !== existingHost);
    staleHosts.forEach((host) => host.remove());

    if (existingHost) {
      return;
    }

    anchorNode.classList.add("prof-instructor-name");

    const overlay = document.createElement("span");
    overlay.className = "prof-overlay";

    if (pageConfig.showRmp && result.rmp) {
      overlay.appendChild(
        createChip({
          label: `RMP ${formatNumber(result.rmp.avgRating)}`,
          title: `${result.rmp.numRatings} ratings`,
          href: result.rmp.link,
          modifier: "rmp"
        })
      );
    }

    if (pageConfig.showCougarGrades && result.cougarGrades) {
      overlay.appendChild(
        createChip({
          label: "CG Prof",
          title: result.cougarGrades.fullName,
          href: result.cougarGrades.link,
          modifier: "cg"
        })
      );

      result.cougarGrades.badges.forEach((badge) => {
        overlay.appendChild(
          createChip({
            label: `CG ${badge.text}`,
            title: badge.caption,
            href: result.cougarGrades.link,
            modifier: "cg"
          })
        );
      });
    }

    if (!overlay.childNodes.length) {
      return;
    }

    const host = document.createElement("div");
    host.className = "prof-overlay-host";
    host.appendChild(overlay);

    anchorNode.insertAdjacentElement("afterend", host);
  }

  function renderCourseOverlay(anchorNode, courseCode) {
    if (anchorNode.parentElement?.querySelector(":scope > .prof-overlay--course-header")) {
      return;
    }

    const overlay = document.createElement("span");
    overlay.className = "prof-overlay prof-overlay--course-header";
    overlay.appendChild(
      createChip({
        label: `CG ${courseCode}`,
        title: `View ${courseCode} on CougarGrades`,
        href: `https://cougargrades.io/c/${encodeURIComponent(courseCode)}`,
        modifier: "cg-course"
      })
    );

    anchorNode.insertAdjacentElement("afterend", overlay);
  }

  function createChip({ label, title, href, modifier }) {
    const link = document.createElement("a");
    link.className = `prof-overlay__chip prof-overlay__chip--${modifier}`;
    link.href = href;
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
      window.open(href, "_blank", "noopener,noreferrer");
    };
    link.addEventListener("pointerdown", stopRowClick);
    link.addEventListener("mousedown", stopRowClick);
    link.addEventListener("mouseup", stopRowClick);
    link.addEventListener("click", openWithoutRowNavigation);
    return link;
  }

  function extractProfessorName(node) {
    const text = (node.textContent || "").trim();
    if (!text) {
      return "";
    }

    return text
      .split(/\s{2,}|\/|;|\|/)
      .map((segment) => segment.trim())
      .find((segment) => /^[A-Za-z ,.'-]{4,}$/.test(segment)) || "";
  }

  function extractCourseCode(node, selector) {
    const row = node.closest(config.courseRowSelector);
    const scopedMatch = row?.querySelector(selector);
    const directMatch = scopedMatch || document.querySelector(selector);
    const text = (directMatch?.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
    const match = text.match(/\b([A-Z]{2,5}\s?\d{4})\b/);
    return match ? match[1].replace(/\s+/, " ") : "";
  }

  function isCourseHeaderNode(node) {
    return !node.closest("tr, table, [role='row'], .ps_grid-row");
  }

  function isEnabledForCurrentPage(patterns) {
    return (patterns || []).some((pattern) => {
      const regex = wildcardToRegExp(pattern);
      return regex.test(window.location.href);
    });
  }

  function wildcardToRegExp(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  }

  function formatNumber(value) {
    if (value === null || value === undefined) {
      return "N/A";
    }

    return Number(value).toFixed(1);
  }
})();
