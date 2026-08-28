// source of truth for default settings
globalThis.PROFCHECK_DEFAULTS = {
  universityName: "University of Houston",
  courseRowSelector: "[data-course-row], tr, .course-row, .class-row",
  instructorSelector: "span[id*='SSR_INSTR_LONG'], [data-instructor], .instructor, .professor, .faculty-name",
  courseCodeSelector: "span[id*='SSS_SUBJ_CATLG'], [data-course-code], .course-code, .subject-catalog",
  showRmp: true,
  showCougarGrades: true,
  defaultScoringMode: "balanced",
  rmpStrictSearch: true,
  cougarGradesBaseUrl: "https://cougargrades.io",
  cougarGradesApiBaseUrl: "https://api.cougargrades.io",
  rmpProfessorBaseUrl: "https://www.ratemyprofessors.com/professor"
};
