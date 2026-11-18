// Chrome loads a single service-worker file; Firefox lists both in the manifest.
globalThis.importScripts?.("config.js", "campuses.js", "campus-access.js");

const extensionApi = globalThis.browser ?? globalThis.chrome;
const DEFAULT_CONFIG = globalThis.PROFCHECK_DEFAULTS;
const CAMPUSES = globalThis.PROFCHECK_CAMPUSES;
const COURSE_CODE_PATTERN = /\b([A-Z]{2,5}\s?\d{4})\b/;
const LOOKUP_TIMEOUT_MS = 15000;

const MESSAGE_HANDLERS = {
  LOOKUP_PROFESSOR: handleProfessorLookup,
  LOOKUP_COURSE: handleCourseLookup,
  CLEAR_CACHE: clearLookupCache
};

// Fills in missing settings only; a value the user already has is never replaced.
extensionApi.runtime.onInstalled.addListener(async () => {
  const stored = await extensionApi.storage.sync.get([...Object.keys(DEFAULT_CONFIG), "campuses"]);
  await extensionApi.storage.sync.set({
    ...DEFAULT_CONFIG,
    ...stored,
    campuses: mergeCampusSettings(stored.campuses)
  });
  await reconcileCampusAccess();
});

extensionApi.runtime.onStartup?.addListener(reconcileCampusAccess);

extensionApi.permissions?.onRemoved?.addListener((removed) => {
  globalThis.PROFCHECK_CAMPUS_ACCESS.handlePermissionsRemoved(extensionApi, CAMPUSES, removed)
    .catch((error) => console.error("Could not turn off a campus after access was removed", error));
});

/** Registered campus scripts must match settings and granted hosts after every restart. */
async function reconcileCampusAccess() {
  try {
    await globalThis.PROFCHECK_CAMPUS_ACCESS?.reconcileCampusAccess(extensionApi, CAMPUSES);
  } catch (error) {
    console.error("Could not reconcile campus access", error);
  }
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = MESSAGE_HANDLERS[message?.type];
  if (!handler) {
    return false;
  }

  authorizeMessage(message.type, sender)
    .then((campus) => handler(message.payload, campus))
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      logFailure(`Background handler failed for ${message.type}`, error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

/**
 * Lookups only run for content scripts on an enabled campus whose adapter lists
 * the data source; the cache can only be cleared from the extension's own pages.
 * Resolves with the sender's campus, or rejects before any network request.
 */
async function authorizeMessage(type, sender) {
  if (!sender || sender.id !== extensionApi.runtime.id) {
    throw new Error("Message rejected: unknown sender.");
  }

  if (type === "CLEAR_CACHE") {
    if (!String(sender.url ?? "").startsWith(extensionApi.runtime.getURL(""))) {
      throw new Error("Message rejected: cache can only be cleared from settings.");
    }
    return null;
  }

  const campus = CAMPUSES.campusForUrl(sender.url ?? sender.tab?.url ?? "");
  if (!campus) {
    throw new Error("Message rejected: page is not a supported campus portal.");
  }

  const { campuses } = await extensionApi.storage.sync.get("campuses");
  if (!mergeCampusSettings(campuses)[campus.id]?.enabled) {
    throw new Error(`Message rejected: ${campus.id} is turned off.`);
  }

  const neededSources = type === "LOOKUP_COURSE" ? ["cougargrades"] : ["rmp", "cougargrades"];
  if (!neededSources.some((source) => campus.dataSources.includes(source))) {
    throw new Error(`Message rejected: ${campus.id} has no approved data source for this lookup.`);
  }

  return campus;
}

function mergeCampusSettings(stored) {
  const merged = CAMPUSES.defaultCampusSettings();
  if (stored && typeof stored === "object") {
    for (const [id, value] of Object.entries(stored)) {
      merged[id] = { ...merged[id], ...value };
    }
  }
  return merged;
}

/** A source runs only when the user enabled it and the campus is approved for it. */
function allowedConfig(config, campus) {
  return {
    ...config,
    showRmp: config.showRmp && campus.dataSources.includes("rmp"),
    showCougarGrades: config.showCougarGrades && campus.dataSources.includes("cougargrades")
  };
}

async function handleProfessorLookup(payload, campus) {
  const config = allowedConfig(await loadConfig(), campus);
  const professorName = normalizeName(payload?.professorName);
  if (!professorName) {
    return null;
  }

  const courseCode = normalizeCourseCode(payload?.courseCode);
  const cacheKey = `professor::${JSON.stringify([
    professorName.toLowerCase(), config.universityName, config.showRmp,
    config.showCougarGrades, config.rmpStrictSearch, config.cougarGradesApiBaseUrl,
    config.cougarGradesBaseUrl, config.rmpProfessorBaseUrl
  ])}`;
  const cached = await readCachedLookup(cacheKey);
  if (cached) {
    return { ...cached.result, courseCode };
  }

  const lastFirstName = toLastFirst(professorName);
  // Settled, not all: a failing RMP call must not discard good CougarGrades data.
  const [rmp, cougarGrades] = await Promise.allSettled([
    config.showRmp ? fetchRmp(professorName, config) : null,
    config.showCougarGrades ? fetchCougarGradesInstructor(lastFirstName, config) : null
  ]);

  const result = {
    name: professorName,
    courseCode,
    rmp: settledValue(rmp, "RMP"),
    cougarGrades: settledValue(cougarGrades, "CougarGrades instructor"),
    // Lets the page tell "no record" apart from "service unreachable".
    failed: { rmp: rmp.status === "rejected", cougarGrades: cougarGrades.status === "rejected" }
  };

  // A partial result is worth showing but not worth remembering.
  if (rmp.status === "fulfilled" && cougarGrades.status === "fulfilled") {
    await writeCachedLookup(cacheKey, result);
  }

  return result;
}

async function handleCourseLookup(payload, campus) {
  const config = allowedConfig(await loadConfig(), campus);
  const courseCode = normalizeCourseCode(payload?.courseCode);
  if (!courseCode || !config.showCougarGrades) {
    return null;
  }

  const cacheKey = `course::${JSON.stringify([
    courseCode, config.cougarGradesApiBaseUrl, config.cougarGradesBaseUrl
  ])}`;
  const cached = await readCachedLookup(cacheKey);
  if (cached) {
    return cached.result;
  }

  const result = await fetchCougarGradesCourse(courseCode, config);
  await writeCachedLookup(cacheKey, result);
  return result;
}

async function clearLookupCache() {
  await extensionApi.storage.session.clear();
  return { cleared: true };
}

// storage.session survives service-worker restarts; an in-memory Map does not.
async function readCachedLookup(cacheKey) {
  const stored = await extensionApi.storage.session.get(cacheKey);
  return stored[cacheKey];
}

async function writeCachedLookup(cacheKey, result) {
  await extensionApi.storage.session.set({ [cacheKey]: { result } });
}

function settledValue(settled, sourceName) {
  if (settled.status === "fulfilled") {
    return settled.value;
  }

  logFailure(`${sourceName} lookup failed`, settled.reason);
  return null;
}

/**
 * Offline, blocked, timed out, or a server error: normal outside our control,
 * so it stays out of the red Errors list on chrome://extensions.
 */
function isServiceFailure(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError" || error?.name === "ServiceError"
    || (error?.name === "TypeError" && /fetch|network/i.test(error.message ?? ""));
}

function logFailure(context, error) {
  if (isServiceFailure(error)) {
    console.info(`${context}: ${error.message}`);
  } else {
    console.error(context, error);
  }
}

async function loadConfig() {
  return {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };
}

async function fetchJson(url) {
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  if (!response.ok) {
    const error = new Error(`${url.pathname} failed with ${response.status}`);
    error.name = "ServiceError";
    throw error;
  }

  return response.json();
}

async function fetchRmp(professorName, config) {
  const url = new URL("/api/external/rmp/search", config.cougarGradesApiBaseUrl);
  url.searchParams.set("query", professorName);
  url.searchParams.set("strict", String(Boolean(config.rmpStrictSearch)));

  const candidates = await fetchJson(url);
  if (!Array.isArray(candidates)) {
    return null;
  }

  const schoolMatch = candidates.find((candidate) =>
    candidate.school?.name?.toLowerCase() === config.universityName.toLowerCase()
  );

  // An identically named instructor at another university is not a match.
  const best = schoolMatch;
  if (!best) {
    return null;
  }

  return {
    avgRating: best.avgRatingRounded,
    numRatings: best.numRatings,
    link: `${config.rmpProfessorBaseUrl}/${best.legacyId}`
  };
}

async function fetchCougarGradesInstructor(lastFirstName, config) {
  const payload = await fetchJson(new URL(`/api/instructor/${encodeURIComponent(lastFirstName)}`, config.cougarGradesApiBaseUrl));
  if (!payload?.meta) {
    return null;
  }

  return {
    gpa: findBadgeValue(payload.badges, "gpa"),
    dropRate: findBadgeValue(payload.badges, "droprate"),
    link: `${config.cougarGradesBaseUrl}/i/${encodeURIComponent(payload.meta.fullNameLastNameFirst || lastFirstName)}`
  };
}

async function fetchCougarGradesCourse(courseCode, config) {
  const payload = await fetchJson(new URL(`/api/course/${encodeURIComponent(courseCode)}`, config.cougarGradesApiBaseUrl));
  if (!payload?.meta?._id) {
    return null;
  }

  return {
    gpa: findBadgeValue(payload.badges, "gpa"),
    dropRate: findBadgeValue(payload.badges, "droprate"),
    link: `${config.cougarGradesBaseUrl}/c/${encodeURIComponent(payload.meta._id)}`
  };
}

/** Parenthetical titles come out before whitespace collapses, not after. */
function normalizeName(input) {
  if (/^\s*(staff|tba|to be announced)\s*$/i.test(String(input || ""))) return "";
  return String(input || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(input) {
  const match = String(input || "").toUpperCase().match(COURSE_CODE_PATTERN);
  return match ? match[1].replace(/\s+/, " ").replace(/([A-Z])(\d)/, "$1 $2") : "";
}

function toLastFirst(name) {
  if (name.includes(",")) {
    return name;
  }

  const nameParts = name.split(" ").filter(Boolean);
  if (nameParts.length < 2) {
    return name;
  }

  const lastName = nameParts.pop();
  return `${lastName}, ${nameParts.join(" ")}`;
}

function findBadgeValue(badges, badgeKey) {
  const badge = (badges || []).find((item) => item.key === badgeKey);
  const match = String(badge?.text || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
