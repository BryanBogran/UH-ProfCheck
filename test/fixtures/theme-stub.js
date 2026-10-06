// Local-only extension API substitute. Storage events mirror Chrome across frames/tabs.
(() => {
  const KEY = "profcheck-theme-fixture";
  const extensionRoot = new URL("../../", document.currentScript.src);
  const listeners = [];
  function readSettings() {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  }
  function notify(oldSettings, newSettings) {
    const changes = {};
    for (const key of new Set([...Object.keys(oldSettings), ...Object.keys(newSettings)])) {
      if (oldSettings[key] !== newSettings[key]) {
        changes[key] = { oldValue: oldSettings[key], newValue: newSettings[key] };
      }
    }
    listeners.forEach((callback) => callback(changes, "sync"));
  }
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) notify(JSON.parse(event.oldValue || "{}"), JSON.parse(event.newValue || "{}"));
  });
  globalThis.chrome = {
    storage: {
      sync: {
        get: async () => readSettings(),
        set: async (settings) => {
          const oldSettings = readSettings();
          const newSettings = { ...oldSettings, ...settings };
          localStorage.setItem(KEY, JSON.stringify(newSettings));
          notify(oldSettings, newSettings);
        }
      },
      local: { get: async () => ({}), set: async () => {} },
      onChanged: { addListener: (callback) => listeners.push(callback) }
    },
    runtime: {
      getURL: (path) => new URL(path, extensionRoot).href,
      sendMessage: async (message) => {
        const courseCode = "COSC 1336";
        if (message.type === "LOOKUP_COURSE") return { ok:true, result:{courseCode,gpa:3.0,dropRate:10.3,link:"#course"} };
        const data = {
          "Alex Professor": {rmp:{avgRating:4.3,numRatings:40},cougarGrades:{gpa:3.4,dropRate:6.0,link:"#professor"}},
          "Taylor Instructor": {rmp:{avgRating:3.2,numRatings:30},cougarGrades:{gpa:2.5,dropRate:14.0,link:"#instructor"}},
          "Jaspal Subhlok": {rmp:{avgRating:3.7,numRatings:30},cougarGrades:{gpa:3.0,dropRate:10.3,link:"#professor"}}
        };
        return {ok:true,result:{name:message.payload?.professorName,courseCode,...data[message.payload?.professorName]}};
      }
    }
  };
})();
