const DEFAULT_CONFIG = {
  universityName: "University of Houston",
  enabledUrlPatterns: [
    "https://saprd.my.uh.edu/*"
  ],
  courseRowSelector: "[data-course-row], tr, .course-row, .class-row",
  instructorSelector: "span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name",
  courseCodeSelector: "span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog",
  showRmp: true,
  showCougarGrades: true,
  rmpStrictSearch: true,
  cougarGradesBaseUrl: "https://cougargrades.io",
  cougarGradesApiBaseUrl: "https://api.cougargrades.io",
  rmpProfessorBaseUrl: "https://www.ratemyprofessors.com/professor",
  metrics: ["gpa", "droprate"]
};

const LOOKUP_CACHE = new Map();
const ALLOWED_METRICS = new Set(["gpa", "droprate"]);

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  if (!stored.universityName) {
    await chrome.storage.sync.set(DEFAULT_CONFIG);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "LOOKUP_PROFESSOR") {
    return false;
  }

  handleLookup(message.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      console.error("Professor lookup failed", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleLookup(payload) {
  const config = {
    ...DEFAULT_CONFIG,
    ...(await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };
  config.metrics = (config.metrics || DEFAULT_CONFIG.metrics).filter((metric) => ALLOWED_METRICS.has(metric));

  const normalizedName = normalizeName(payload.professorName);
  if (!normalizedName) {
    return null;
  }

  const cacheKey = JSON.stringify({
    professorName: normalizedName,
    universityName: config.universityName,
    showRmp: config.showRmp,
    showCougarGrades: config.showCougarGrades
  });

  if (LOOKUP_CACHE.has(cacheKey)) {
    return LOOKUP_CACHE.get(cacheKey);
  }

  const lastFirstName = toLastFirst(normalizedName);

  const [rmp, cougarGrades] = await Promise.all([
    config.showRmp ? fetchRmp(normalizedName, config) : Promise.resolve(null),
    config.showCougarGrades ? fetchCougarGrades(lastFirstName, config) : Promise.resolve(null)
  ]);

  const normalizedCourseCode = normalizeCourseCode(payload.courseCode);

  const result = {
    name: normalizedName,
    lastFirstName,
    courseCode: normalizedCourseCode,
    rmp,
    cougarGrades: cougarGrades
      ? {
          ...cougarGrades,
          courseLink: normalizedCourseCode
            ? `${config.cougarGradesBaseUrl}/c/${encodeURIComponent(normalizedCourseCode)}`
            : null
        }
      : null
  };

  LOOKUP_CACHE.set(cacheKey, result);
  return result;
}

async function fetchRmp(name, config) {
  const url = new URL("/api/external/rmp/search", config.cougarGradesApiBaseUrl);
  url.searchParams.set("query", name);
  url.searchParams.set("strict", String(Boolean(config.rmpStrictSearch)));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`RMP lookup failed with ${response.status}`);
  }

  const candidates = await response.json();
  const schoolMatch = candidates.find((candidate) =>
    candidate.school?.name?.toLowerCase() === config.universityName.toLowerCase()
  );

  const best = schoolMatch || candidates[0];
  if (!best) {
    return null;
  }

  return {
    source: "ratemyprofessors",
    legacyId: best.legacyId,
    firstName: best.firstName,
    lastName: best.lastName,
    department: best.department,
    avgRating: best.avgRatingRounded,
    numRatings: best.numRatings,
    wouldTakeAgainPercent: best.wouldTakeAgainPercentRounded,
    difficulty: best.avgDifficultyRounded,
    link: `${config.rmpProfessorBaseUrl}/${best.legacyId}`
  };
}

async function fetchCougarGrades(lastFirstName, config) {
  const url = new URL(`/api/instructor/${encodeURIComponent(lastFirstName)}`, config.cougarGradesApiBaseUrl);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CougarGrades lookup failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !payload.meta) {
    return null;
  }

  const metricLookup = new Map((payload.badges || []).map((badge) => [badge.key, badge]));
  const selectedBadges = (config.metrics || [])
    .map((metricKey) => metricLookup.get(metricKey))
    .filter(Boolean);

  return {
    source: "cougargrades",
    fullName: payload.meta.fullName,
    fullNameLastFirst: payload.meta.fullNameLastNameFirst || lastFirstName,
    department: payload.meta.descriptionDepartmentsInvolved,
    firstTaught: payload.firstTaught,
    lastTaught: payload.lastTaught,
    badges: selectedBadges,
    link: `${config.cougarGradesBaseUrl}/i/${encodeURIComponent(payload.meta.fullNameLastNameFirst || lastFirstName)}`
  };
}

function normalizeName(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(staff|tba|to be announced)\b/gi, "")
    .trim();
}

function normalizeCourseCode(input) {
  const text = String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const match = text.match(/\b([A-Z]{2,5}\s?\d{4})\b/);
  if (!match) {
    return "";
  }

  return match[1].replace(/\s+/, " ");
}

function toLastFirst(name) {
  if (!name) {
    return "";
  }

  if (name.includes(",")) {
    return name;
  }

  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return name;
  }

  const lastName = parts.pop();
  return `${lastName}, ${parts.join(" ")}`;
}
