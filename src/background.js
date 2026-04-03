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
  enablePlannerTray: true,
  showConfidence: true,
  defaultScoringMode: "balanced",
  rmpStrictSearch: true,
  cougarGradesBaseUrl: "https://cougargrades.io",
  cougarGradesApiBaseUrl: "https://api.cougargrades.io",
  rmpProfessorBaseUrl: "https://www.ratemyprofessors.com/professor"
};

const extensionApi = globalThis.browser ?? globalThis.chrome;
const LOOKUP_CACHE = new Map();

extensionApi.runtime.onInstalled.addListener(async () => {
  const stored = await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const merged = { ...DEFAULT_CONFIG, ...stored };
  await extensionApi.storage.sync.set(merged);
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    LOOKUP_PROFESSOR: () => handleProfessorLookup(message.payload),
    LOOKUP_COURSE: () => handleCourseLookup(message.payload),
    CLEAR_CACHE: async () => {
      LOOKUP_CACHE.clear();
      return { cleared: true };
    }
  };

  const handler = handlers[message?.type];
  if (!handler) {
    return false;
  }

  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      console.error(`Background handler failed for ${message?.type}`, error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleProfessorLookup(payload) {
  const config = await loadConfig();
  const normalizedName = normalizeName(payload?.professorName);

  if (!normalizedName) {
    return null;
  }

  const cacheKey = JSON.stringify({
    type: "professor",
    professorName: normalizedName,
    universityName: config.universityName,
    showRmp: config.showRmp,
    showCougarGrades: config.showCougarGrades
  });

  if (LOOKUP_CACHE.has(cacheKey)) {
    return LOOKUP_CACHE.get(cacheKey);
  }

  const lastFirstName = toLastFirst(normalizedName);
  const normalizedCourseCode = normalizeCourseCode(payload?.courseCode);

  const [rmp, cougarGrades] = await Promise.all([
    config.showRmp ? fetchRmp(normalizedName, config) : Promise.resolve(null),
    config.showCougarGrades ? fetchCougarGradesInstructor(lastFirstName, config) : Promise.resolve(null)
  ]);

  const result = {
    name: normalizedName,
    lastFirstName,
    courseCode: normalizedCourseCode,
    rmp,
    cougarGrades
  };

  LOOKUP_CACHE.set(cacheKey, result);
  return result;
}

async function handleCourseLookup(payload) {
  const config = await loadConfig();
  const courseCode = normalizeCourseCode(payload?.courseCode);

  if (!courseCode || !config.showCougarGrades) {
    return null;
  }

  const cacheKey = JSON.stringify({
    type: "course",
    courseCode
  });

  if (LOOKUP_CACHE.has(cacheKey)) {
    return LOOKUP_CACHE.get(cacheKey);
  }

  const result = await fetchCougarGradesCourse(courseCode, config);
  LOOKUP_CACHE.set(cacheKey, result);
  return result;
}

async function loadConfig() {
  return {
    ...DEFAULT_CONFIG,
    ...(await extensionApi.storage.sync.get(Object.keys(DEFAULT_CONFIG)))
  };
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

async function fetchCougarGradesInstructor(lastFirstName, config) {
  const url = new URL(`/api/instructor/${encodeURIComponent(lastFirstName)}`, config.cougarGradesApiBaseUrl);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CougarGrades instructor lookup failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.meta) {
    return null;
  }

  return {
    source: "cougargrades",
    fullName: payload.meta.fullName,
    fullNameLastFirst: payload.meta.fullNameLastNameFirst || lastFirstName,
    department: payload.meta.descriptionDepartmentsInvolved,
    firstTaught: payload.firstTaught,
    lastTaught: payload.lastTaught,
    gpa: findBadgeValue(payload.badges, "gpa"),
    dropRate: findBadgeValue(payload.badges, "droprate"),
    sectionCount: payload.sectionCount ?? null,
    courseCount: payload.courseCount ?? null,
    topCourses: (payload.topCourses || []).slice(0, 4).map((course) => ({
      courseName: course.courseName,
      totalEnrolled: course.totalEnrolled
    })),
    badges: (payload.badges || []).map((badge) => ({
      key: badge.key,
      text: badge.text,
      caption: badge.caption
    })),
    link: `${config.cougarGradesBaseUrl}/i/${encodeURIComponent(payload.meta.fullNameLastNameFirst || lastFirstName)}`
  };
}

async function fetchCougarGradesCourse(courseCode, config) {
  const url = new URL(`/api/course/${encodeURIComponent(courseCode)}`, config.cougarGradesApiBaseUrl);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CougarGrades course lookup failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.meta?._id) {
    return null;
  }

  const rows = Array.isArray(payload.dataGrid?.rows) ? payload.dataGrid.rows : [];

  return {
    source: "cougargrades-course",
    courseCode: payload.meta._id,
    title: payload.meta.longDescription || payload.meta.description || payload.meta._id,
    department: payload.meta.department,
    catalogNumber: payload.meta.catalogNumber,
    firstTaught: payload.firstTaught,
    lastTaught: payload.lastTaught,
    gpa: findBadgeValue(payload.badges, "gpa"),
    dropRate: findBadgeValue(payload.badges, "droprate"),
    classSize: payload.classSize ?? null,
    sectionCount: payload.sectionCount ?? rows.length,
    instructorCount: payload.instructorCount ?? null,
    seasonalAvailability: toSeasonNames(payload.seasonalAvailability?.ratioSorted),
    topInstructors: (payload.relatedInstructors || []).slice(0, 4).map((instructor) => ({
      name: instructor.title,
      gpa: findBadgeValue(instructor.badges, "gpa"),
      dropRate: findBadgeValue(instructor.badges, "droprate"),
      caption: instructor.caption
    })),
    recentSections: rows
      .slice()
      .sort((left, right) => (right.term || 0) - (left.term || 0))
      .slice(0, 24)
      .map((row) => ({
        term: row.term,
        termString: row.termString,
        sectionNumber: row.sectionNumber != null ? String(row.sectionNumber) : "",
        primaryInstructorName: row.primaryInstructorName || "",
        semesterGPA: numberOrNull(row.semesterGPA),
        totalEnrolled: numberOrNull(row.totalEnrolled),
        dropRate: calculateDropRate(row)
      })),
    link: `${config.cougarGradesBaseUrl}/c/${encodeURIComponent(payload.meta._id)}`
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

  const match = text.match(/\b([A-Z]{2,5}\s*\d{3,4})\b/);
  return match ? match[1].replace(/\s+/, " ") : "";
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

function findBadgeValue(badges, key) {
  const badge = (badges || []).find((item) => item.key === key);
  if (!badge?.text) {
    return null;
  }

  const match = String(badge.text).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function calculateDropRate(row) {
  const grades = ["A", "B", "C", "D", "F", "W", "S", "NCR"];
  const totals = grades.reduce((sum, key) => sum + (Number(row?.[key]) || 0), 0);
  if (!totals) {
    return null;
  }

  return ((Number(row?.W) || 0) / totals) * 100;
}

function toSeasonNames(ratioSorted) {
  const seasonMap = {
    "01": "Spring",
    "02": "Summer",
    "03": "Fall"
  };

  return Object.entries(ratioSorted || {})
    .sort((left, right) => right[1] - left[1])
    .map(([key]) => seasonMap[key])
    .filter(Boolean);
}
