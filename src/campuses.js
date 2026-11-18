// Campus registry: metadata only, shared by the background worker, content
// scripts, and the options page. Page parsing lives in src/adapters/<id>.js.
(function registerCampuses(root) {
  const CAMPUSES = Object.freeze([
    Object.freeze({
      id: "uh",
      displayName: "University of Houston",
      host: "saprd.my.uh.edu",
      pathPattern: null,
      allFrames: false,
      status: "supported", // testing | beta | supported | paused
      defaultEnabled: true,
      // UH ships as a static manifest content script; other campuses are
      // registered at runtime after the user grants their optional host.
      staticScript: true,
      features: Object.freeze({ seats: true, instructors: true, grades: true, ratings: true, rankings: true }),
      dataSources: Object.freeze(["cougargrades", "rmp"])
    })
  ]);

  const BY_ID = new Map(CAMPUSES.map((campus) => [campus.id, campus]));

  function byId(id) {
    return BY_ID.get(id) ?? null;
  }

  /** Returns the campus whose exact host (and optional path) matches, or null. */
  function campusForUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:") {
      return null;
    }
    return CAMPUSES.find((campus) => campus.host === parsed.hostname
      && (!campus.pathPattern || new RegExp(campus.pathPattern).test(parsed.pathname))) ?? null;
  }

  function defaultCampusSettings() {
    return Object.fromEntries(CAMPUSES.map((campus) => [campus.id, { enabled: campus.defaultEnabled }]));
  }

  // The engine's content scripts in load order. UH's manifest entry and every
  // runtime-registered campus use this list; only the adapter file differs.
  const ADAPTER_SLOT = "src/adapters/<id>.js";
  const CONTENT_SCRIPT_TEMPLATE = Object.freeze([
    "src/config.js",
    "src/parse.js",
    "src/scoring.js",
    "src/campuses.js",
    "src/adapters/registry.js",
    ADAPTER_SLOT,
    "src/content.js",
    "src/launcher.js"
  ]);
  const CONTENT_STYLES = Object.freeze(["src/content.css"]);

  function contentScriptFilesFor(campus) {
    return CONTENT_SCRIPT_TEMPLATE.map((file) => (file === ADAPTER_SLOT ? `src/adapters/${campus.id}.js` : file));
  }

  /** The optional host permission pattern a campus needs. */
  function originFor(campus) {
    return `https://${campus.host}/*`;
  }

  root.PROFCHECK_CAMPUSES = Object.freeze({
    list: CAMPUSES,
    byId,
    campusForUrl,
    defaultCampusSettings,
    contentScriptFilesFor,
    originFor,
    contentStyles: CONTENT_STYLES
  });
})(globalThis);
