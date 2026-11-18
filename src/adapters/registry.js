// Adapter registry. Each src/adapters/<id>.js calls register() once; the engine
// in src/content.js looks the active campus's adapter up by campus id.
// Campus metadata (host, features, data sources) lives in src/campuses.js.
globalThis.PROFCHECK_ADAPTERS = globalThis.PROFCHECK_ADAPTERS ?? (() => {
  const adapters = new Map();

  function register(adapter) {
    if (!adapter || typeof adapter.id !== "string" || typeof adapter.findSections !== "function") {
      throw new TypeError("An adapter needs a string id and a findSections(root, ctx) function");
    }
    if (adapters.has(adapter.id)) {
      throw new Error(`Adapter "${adapter.id}" is already registered`);
    }
    adapters.set(adapter.id, Object.freeze({ ...adapter }));
  }

  function get(id) {
    return adapters.get(id) ?? null;
  }

  function list() {
    return [...adapters.values()];
  }

  return Object.freeze({ register, get, list });
})();
