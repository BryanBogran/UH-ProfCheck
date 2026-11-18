// Test double for the engine checks. Configure with data attributes on the tag:
//   data-url="https://host/path"   page URL the engine sees (picks the campus)
//   data-lookups="ok|fail|hang|unreachable|rated"  how LOOKUP_* messages answer
//   data-settings='{"key":value}'  initial storage.sync contents
// It never sends network requests.
(() => {
  const script = document.currentScript;
  const settings = JSON.parse(script.dataset.settings || "{}");
  const listeners = [], calls = [], errors = [], warnings = [];
  globalThis.PROFCHECK_PAGE_URL = script.dataset.url;

  const set = async (values) => {
    const changes = {};
    for (const [key, value] of Object.entries(values)) {
      changes[key] = { oldValue: settings[key], newValue: value };
      settings[key] = value;
    }
    listeners.forEach((fn) => fn(changes, "sync"));
  };

  window.ENGINE_TEST = { settings, set, calls, errors, warnings, lookups: script.dataset.lookups || "ok" };
  window.addEventListener("error", (e) => errors.push(String(e.error?.stack || e.message)));
  window.addEventListener("unhandledrejection", (e) => errors.push(String(e.reason?.stack || e.reason)));
  const originalError = console.error.bind(console);
  console.error = (...args) => { errors.push(args.map(String).join(" ")); originalError(...args); };
  const originalWarn = console.warn.bind(console);
  console.warn = (...args) => { warnings.push(args.map(String).join(" ")); originalWarn(...args); };

  globalThis.chrome = {
    storage: {
      sync: { get: async () => ({ ...settings }), set },
      local: { get: async () => ({}), set: async () => {} },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    },
    runtime: {
      getURL: (path) => new URL(path, new URL("../../", script.src)).href,
      sendMessage: (message) => {
        calls.push(message);
        const mode = window.ENGINE_TEST.lookups;
        if (mode === "hang") return new Promise(() => {});
        if (mode === "fail") return Promise.resolve({ ok: false, error: "Simulated API outage" });
        const professor = message.type === "LOOKUP_PROFESSOR";
        if (mode === "unreachable" && professor) {
          return Promise.resolve({ ok: true, result: { rmp: null, cougarGrades: null, failed: { rmp: true, cougarGrades: true } } });
        }
        if (mode === "rated" && professor) {
          return Promise.resolve({ ok: true, result: { rmp: { avgRating: 4.2, numRatings: 12, link: "#rmp" }, cougarGrades: null } });
        }
        return Promise.resolve({ ok: true, result: null });
      }
    }
  };
})();
