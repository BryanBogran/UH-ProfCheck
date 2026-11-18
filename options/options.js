const extensionApi = globalThis.browser ?? globalThis.chrome;
const DEFAULT_CONFIG = globalThis.PROFCHECK_DEFAULTS;
const CAMPUSES = globalThis.PROFCHECK_CAMPUSES;
const CAMPUS_STATUS_LABELS = { testing: "Testing", beta: "Beta", supported: "Supported", paused: "Paused" };
const FEATURE_LABELS = { seats: "Seats", instructors: "Instructors", grades: "Grades", ratings: "Ratings", rankings: "Rankings" };
const SELECTOR_FIELD_IDS = ["courseRowSelector", "instructorSelector", "courseCodeSelector"];
const STATUS_CLEAR_DELAY_MS = 1800;

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("status");

restoreSettings();
renderCampuses();
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
  form.darkMode.checked = config.darkMode;
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

  try {
    await extensionApi.storage.sync.set({
      ...selectors,
      universityName,
      showRmp: form.showRmp.checked,
      showCougarGrades: form.showCougarGrades.checked,
      darkMode: form.darkMode.checked,
      defaultScoringMode: form.defaultScoringMode.value
    });
    setStatus("Settings saved.");
  } catch (error) {
    setStatus(`Could not save settings: ${error.message}`);
  }
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
    const response = await extensionApi.runtime.sendMessage({ type: "CLEAR_CACHE" });
    if (!response?.ok) throw new Error(response?.error || "No response from the extension.");
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

async function readCampusSettings() {
  const { campuses } = await extensionApi.storage.sync.get("campuses");
  const merged = CAMPUSES.defaultCampusSettings();
  Object.entries(campuses ?? {}).forEach(([id, value]) => {
    merged[id] = { ...merged[id], ...value };
  });
  return merged;
}

async function renderCampuses() {
  const list = document.getElementById("campus-list");
  const settings = await readCampusSettings();
  list.replaceChildren(...CAMPUSES.list.map((campus) => createCampusRow(campus, settings[campus.id]?.enabled)));
}

function createCampusRow(campus, enabled) {
  const item = document.createElement("li");
  item.className = "campus";

  const label = document.createElement("label");
  label.className = "checkbox campus__toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(enabled);
  input.dataset.campusId = campus.id;
  input.addEventListener("change", () => toggleCampus(campus, input));
  const name = document.createElement("span");
  name.className = "campus__name";
  name.textContent = campus.displayName;
  label.append(input, name);

  const status = document.createElement("span");
  status.className = `campus__status campus__status--${campus.status}`;
  status.textContent = CAMPUS_STATUS_LABELS[campus.status] ?? campus.status;

  const features = document.createElement("p");
  features.className = "campus__features";
  features.textContent = Object.entries(campus.features)
    .filter(([, supported]) => supported)
    .map(([feature]) => FEATURE_LABELS[feature] ?? feature)
    .join(" · ");

  item.append(label, status, features);
  return item;
}

async function toggleCampus(campus, input) {
  const enabled = input.checked;
  input.disabled = true;
  try {
    if (!campus.staticScript && !(await setCampusAccess(campus, enabled))) {
      input.checked = !enabled;
      setCampusStatus(`Access to ${campus.displayName} was not granted, so it stays off.`);
      return;
    }

    const settings = await readCampusSettings();
    settings[campus.id] = { ...settings[campus.id], enabled };
    await extensionApi.storage.sync.set({ campuses: settings });
    setCampusStatus(`${campus.displayName} turned ${enabled ? "on" : "off"}. Reload your portal tab.`);
  } catch (error) {
    input.checked = !enabled;
    setCampusStatus(`Could not update ${campus.displayName}: ${error.message}`);
  } finally {
    input.disabled = false;
  }
}

/** Runs inside the click handler so permissions.request keeps the user gesture. */
function setCampusAccess(campus, enabled) {
  return globalThis.PROFCHECK_CAMPUS_ACCESS.setCampusAccess(extensionApi, CAMPUSES, campus, enabled);
}

function setCampusStatus(message) {
  document.getElementById("campus-status").textContent = message;
}
