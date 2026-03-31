const DEFAULT_CONFIG = {
  universityName: "University of Houston",
  enabledUrlPatterns: ["https://saprd.my.uh.edu/*"],
  courseRowSelector: "[data-course-row], tr, .course-row, .class-row",
  instructorSelector: "span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name",
  courseCodeSelector: "span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog",
  showRmp: true,
  showCougarGrades: true
};

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("status");
const probeScriptNode = document.getElementById("probeScript");
const copyProbeButton = document.getElementById("copyProbe");

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
form.addEventListener("submit", save);
copyProbeButton.addEventListener("click", copyProbeScript);
probeScriptNode.value = PROBE_SCRIPT;

async function restore() {
  const config = {
    ...DEFAULT_CONFIG,
    ...(await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };

  document.getElementById("universityName").value = config.universityName;
  document.getElementById("enabledUrlPatterns").value = config.enabledUrlPatterns.join("\n");
  document.getElementById("courseRowSelector").value = config.courseRowSelector;
  document.getElementById("instructorSelector").value = config.instructorSelector;
  document.getElementById("courseCodeSelector").value = config.courseCodeSelector;
  document.getElementById("showRmp").checked = config.showRmp;
  document.getElementById("showCougarGrades").checked = config.showCougarGrades;
}

async function save(event) {
  event.preventDefault();

  const payload = {
    universityName: document.getElementById("universityName").value.trim(),
    enabledUrlPatterns: document
      .getElementById("enabledUrlPatterns")
      .value
      .split("\n")
      .map((pattern) => pattern.trim())
      .filter(Boolean),
    courseRowSelector: document.getElementById("courseRowSelector").value.trim(),
    instructorSelector: document.getElementById("instructorSelector").value.trim(),
    courseCodeSelector: document.getElementById("courseCodeSelector").value.trim(),
    showRmp: document.getElementById("showRmp").checked,
    showCougarGrades: document.getElementById("showCougarGrades").checked
  };

  await chrome.storage.sync.set(payload);
  statusNode.textContent = "Settings saved.";
  setTimeout(() => {
    statusNode.textContent = "";
  }, 1500);
}

async function copyProbeScript() {
  await navigator.clipboard.writeText(PROBE_SCRIPT);
  statusNode.textContent = "Probe script copied.";
  setTimeout(() => {
    statusNode.textContent = "";
  }, 1500);
}
