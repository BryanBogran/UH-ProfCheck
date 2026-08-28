const extensionApi = globalThis.browser ?? globalThis.chrome;
const DEFAULT_CONFIG = globalThis.PROFCHECK_DEFAULTS;
const SELECTOR_FIELD_IDS = ["courseRowSelector", "instructorSelector", "courseCodeSelector"];
const STATUS_CLEAR_DELAY_MS = 1800;

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("status");

restoreSettings();
form.addEventListener("submit", saveSettings);
document.getElementById("clearCache").addEventListener("click", clearCache);

async function restoreSettings() {
  const config = {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };

  form.universityName.value = config.universityName;
  form.showRmp.checked = config.showRmp;
  form.showCougarGrades.checked = config.showCougarGrades;
  form.defaultScoringMode.value = config.defaultScoringMode;
  if (form.defaultScoringMode.selectedIndex < 0) {
    form.defaultScoringMode.value = DEFAULT_CONFIG.defaultScoringMode;
  }

  SELECTOR_FIELD_IDS.forEach((fieldId) => {
    form[fieldId].value = config[fieldId];
  });
}

async function saveSettings(event) {
  event.preventDefault();

  const universityName = form.universityName.value.trim();
  if (!universityName) {
    setStatus("University name is required.");
    return;
  }

  const selectors = {};
  for (const fieldId of SELECTOR_FIELD_IDS) {
    const selector = form[fieldId].value.trim();
    const rejection = describeSelectorProblem(selector);
    if (rejection) {
      setStatus(`${fieldId}: ${rejection}`);
      return;
    }

    selectors[fieldId] = selector;
  }

  await extensionApi.storage.sync.set({
    ...selectors,
    universityName,
    showRmp: form.showRmp.checked,
    showCougarGrades: form.showCougarGrades.checked,
    defaultScoringMode: form.defaultScoringMode.value
  });

  setStatus("Settings saved.");
}

/** An unparseable selector would throw on every page scan, so it never ships. */
function describeSelectorProblem(selector) {
  if (!selector) {
    return "cannot be empty.";
  }

  try {
    document.querySelector(selector);
    return "";
  } catch {
    return "is not a valid CSS selector.";
  }
}

async function clearCache() {
  try {
    await extensionApi.runtime.sendMessage({ type: "CLEAR_CACHE" });
    setStatus("API cache cleared.");
  } catch (error) {
    setStatus(`Could not clear the cache: ${error.message}`);
  }
}

function setStatus(message) {
  statusNode.textContent = message;
  setTimeout(() => {
    if (statusNode.textContent === message) {
      statusNode.textContent = "";
    }
  }, STATUS_CLEAR_DELAY_MS);
}
