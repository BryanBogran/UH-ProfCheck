const DEFAULT_CONFIG = {
  universityName: "University of Houston",
  enabledUrlPatterns: ["https://saprd.my.uh.edu/*"],
  courseRowSelector: "[data-course-row], tr, .course-row, .class-row",
  instructorSelector: "span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name",
  courseCodeSelector: "span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog",
  showRmp: true,
  showCougarGrades: true,
  enablePlannerTray: true,
  showConfidence: true,
  enableDarkMode: false,
  defaultScoringMode: "balanced"
};

const extensionApi = globalThis.browser ?? globalThis.chrome;

const SCORING_MODES = new Set(["balanced", "easiestA", "lowestRisk"]);

const LOCAL_STORAGE_KEYS = ["profOverlayShortlist"];

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("status");
const probeScriptNode = document.getElementById("probeScript");
const copyProbeButton = document.getElementById("copyProbe");
const clearLocalDataButton = document.getElementById("clearLocalData");
const clearCacheButton = document.getElementById("clearCache");

const PROBE_SCRIPT = String.raw`(() => {
  const seen = new Set();
  const blockedPhrases = [
    "previous in list",
    "next in list",
    "get help",
    "leave feedback",
    "new window",
    "my preferences",
    "sign out",
    "view my classes",
    "manage classes",
    "enrollment",
    "shopping cart"
  ];

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    const parts = [];
    let node = el;

    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();

      if (node.id) {
        part += "#" + CSS.escape(node.id);
        parts.unshift(part);
        break;
      }

      const classNames = [...node.classList].slice(0, 2).map((name) => "." + CSS.escape(name)).join("");
      if (classNames) {
        part += classNames;
      }

      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((child) => child.tagName === node.tagName);
        if (siblings.length > 1) {
          part += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
        }
      }

      parts.unshift(part);
      node = node.parentElement;
    }

    return parts.join(" > ");
  }

  function rowPath(el) {
    const row = el.closest("tr, li, article, .ps_grid-row, [role='row'], .row, .class-row, .course-row");
    return row ? cssPath(row) : "";
  }

  function looksLikeProfessorName(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return false;

    const lower = normalized.toLowerCase();
    if (blockedPhrases.includes(lower)) return false;
    if (/\d/.test(normalized)) return false;
    if (normalized.length < 6 || normalized.length > 40) return false;

    const lastFirst = /^[A-Z][A-Za-z.'-]+,\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?$/;
    const firstLast = /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z]\.)?\s+[A-Z][A-Za-z.'-]+$/;
    return lastFirst.test(normalized) || firstLast.test(normalized);
  }

  const candidates = [...document.querySelectorAll("a, span, div, td")]
    .map((el) => ({
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      selector: cssPath(el),
      rowSelector: rowPath(el)
    }))
    .filter((item) => looksLikeProfessorName(item.text))
    .filter((item) => item.selector && item.rowSelector)
    .filter((item) => {
      const key = item.selector + "::" + item.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 25);

  console.table(candidates);
  return candidates;
})();`;

restore();
probeScriptNode.value = PROBE_SCRIPT;

form.addEventListener("submit", save);
copyProbeButton.addEventListener("click", copyProbeScript);
clearLocalDataButton.addEventListener("click", clearLocalData);
clearCacheButton.addEventListener("click", clearCache);

async function restore() {
  const config = {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };

  document.getElementById("universityName").value = config.universityName;
  document.getElementById("enabledUrlPatterns").value = config.enabledUrlPatterns.join("\n");
  document.getElementById("courseRowSelector").value = config.courseRowSelector;
  document.getElementById("instructorSelector").value = config.instructorSelector;
  document.getElementById("courseCodeSelector").value = config.courseCodeSelector;
  document.getElementById("showRmp").checked = config.showRmp;
  document.getElementById("showCougarGrades").checked = config.showCougarGrades;
  document.getElementById("enablePlannerTray").checked = config.enablePlannerTray;
  document.getElementById("showConfidence").checked = config.showConfidence;
  document.getElementById("enableDarkMode").checked = config.enableDarkMode;
  document.getElementById("defaultScoringMode").value = SCORING_MODES.has(config.defaultScoringMode)
    ? config.defaultScoringMode
    : DEFAULT_CONFIG.defaultScoringMode;
}

async function save(event) {
  event.preventDefault();

  const universityName = document.getElementById("universityName").value.trim();
  const courseRowSelector = document.getElementById("courseRowSelector").value.trim();
  const instructorSelector = document.getElementById("instructorSelector").value.trim();
  const courseCodeSelector = document.getElementById("courseCodeSelector").value.trim();

  if (!universityName || !courseRowSelector || !instructorSelector || !courseCodeSelector) {
    setStatus("Advanced settings are missing required values.");
    return;
  }

  const payload = {
    universityName,
    enabledUrlPatterns: document.getElementById("enabledUrlPatterns").value
      .split("\n")
      .map((pattern) => pattern.trim())
      .filter(Boolean),
    courseRowSelector,
    instructorSelector,
    courseCodeSelector,
    showRmp: document.getElementById("showRmp").checked,
    showCougarGrades: document.getElementById("showCougarGrades").checked,
    enablePlannerTray: document.getElementById("enablePlannerTray").checked,
    showConfidence: document.getElementById("showConfidence").checked,
    enableDarkMode: document.getElementById("enableDarkMode").checked,
    defaultScoringMode: SCORING_MODES.has(document.getElementById("defaultScoringMode").value)
      ? document.getElementById("defaultScoringMode").value
      : DEFAULT_CONFIG.defaultScoringMode
  };

  await extensionApi.storage.sync.set(payload);
  setStatus("Settings saved.");
}

async function copyProbeScript() {
  await navigator.clipboard.writeText(PROBE_SCRIPT);
  setStatus("Probe script copied.");
}

async function clearLocalData() {
  await extensionApi.storage.local.remove(LOCAL_STORAGE_KEYS);
  setStatus("Planner data cleared.");
}

async function clearCache() {
  await extensionApi.runtime.sendMessage({ type: "CLEAR_CACHE" });
  setStatus("API cache cleared.");
}

function setStatus(message) {
  statusNode.textContent = message;
  setTimeout(() => {
    if (statusNode.textContent === message) {
      statusNode.textContent = "";
    }
  }, 1800);
}
