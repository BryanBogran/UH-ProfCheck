// Chrome loads a single service-worker file; Firefox lists both in the manifest.
globalThis.importScripts?.("config.js");

const extensionApi = globalThis.browser ?? globalThis.chrome;
const DEFAULT_CONFIG = globalThis.PROFCHECK_DEFAULTS;
const COURSE_CODE_PATTERN = /\b([A-Z]{2,5}\s?\d{4})\b/;

const MESSAGE_HANDLERS = {
  LOOKUP_PROFESSOR: handleProfessorLookup,
  LOOKUP_COURSE: handleCourseLookup,
  CLEAR_CACHE: clearLookupCache
};

extensionApi.runtime.onInstalled.addListener(async () => {
  const stored = await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  await extensionApi.storage.sync.set({ ...DEFAULT_CONFIG, ...stored });
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = MESSAGE_HANDLERS[message?.type];
  if (!handler) {
    return false;
  }

  handler(message.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      console.error(`Background handler failed for ${message.type}`, error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleProfessorLookup(payload) {
  const config = await loadConfig();
  const professorName = normalizeName(payload?.professorName);
  if (!professorName) {
    return null;
  }

  const cacheKey = `professor::${professorName}::${config.universityName}::${config.showRmp}::${config.showCougarGrades}`;
  const cached = await readCachedLookup(cacheKey);
  if (cached) {
    return cached.result;
  }

  const lastFirstName = toLastFirst(professorName);
  // Settled, not all: a failing RMP call must not discard good CougarGrades data.
  const [rmp, cougarGrades] = await Promise.allSettled([
    config.showRmp ? fetchRmp(professorName, config) : null,
    config.showCougarGrades ? fetchCougarGradesInstructor(lastFirstName, config) : null
  ]);

  const result = {
    name: professorName,
    courseCode: normalizeCourseCode(payload?.courseCode),
    rmp: settledValue(rmp, "RMP"),
    cougarGrades: settledValue(cougarGrades, "CougarGrades instructor")
  };

  // A partial result is worth showing but not worth remembering.
  if (rmp.status === "fulfilled" && cougarGrades.status === "fulfilled") {
    await writeCachedLookup(cacheKey, result);
  }

  return result;
}

async function handleCourseLookup(payload) {
  const config = await loadConfig();
  const courseCode = normalizeCourseCode(payload?.courseCode);
  if (!courseCode || !config.showCougarGrades) {
    return null;
  }

  const cacheKey = `course::${courseCode}`;
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

  console.error(`${sourceName} lookup failed`, settled.reason);
  return null;
}

async function loadConfig() {
  return {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };
}

async function fetchJson(url) {
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`${url.pathname} failed with ${response.status}`);
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

  const best = schoolMatch || candidates[0];
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
  return String(input || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(staff|tba|to be announced)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(input) {
  const match = String(input || "").toUpperCase().match(COURSE_CODE_PATTERN);
  return match ? match[1].replace(/\s+/, " ") : "";
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
