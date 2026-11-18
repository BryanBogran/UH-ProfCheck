// Runtime access for campuses that are not built into the manifest: the optional
// host permission plus a registered content script. Shared by the options page
// (user toggles) and the background worker (startup reconcile, revocation).
// Every function takes the extension API and campus list so tests can inject both.
(function registerCampusAccess(root) {
  const SCRIPT_ID_PREFIX = "campus-";

  function scriptIdFor(campus) {
    return `${SCRIPT_ID_PREFIX}${campus.id}`;
  }

  function scriptFor(campuses, campus, persistAcrossSessions) {
    return {
      id: scriptIdFor(campus),
      matches: [campuses.originFor(campus)],
      js: campuses.contentScriptFilesFor(campus),
      css: [...campuses.contentStyles],
      allFrames: Boolean(campus.allFrames),
      runAt: "document_idle",
      persistAcrossSessions
    };
  }

  async function registeredIds(api) {
    const scripts = await api.scripting.getRegisteredContentScripts();
    return new Set(scripts.map((script) => script.id));
  }

  async function registerCampusScript(api, campuses, campus) {
    const exists = (await registeredIds(api)).has(scriptIdFor(campus));
    const method = exists ? "updateContentScripts" : "registerContentScripts";
    try {
      await api.scripting[method]([scriptFor(campuses, campus, true)]);
    } catch (error) {
      // Browsers without persistent registration (older Firefox) still work:
      // the startup reconcile re-registers every session.
      if (!/persist/i.test(error?.message ?? "")) throw error;
      await api.scripting[method]([scriptFor(campuses, campus, false)]);
    }
  }

  async function unregisterCampusScript(api, campus) {
    if ((await registeredIds(api)).has(scriptIdFor(campus))) {
      await api.scripting.unregisterContentScripts({ ids: [scriptIdFor(campus)] });
    }
  }

  /**
   * Called from a click handler: permissions.request must be the first await so
   * the browser still sees the user gesture. Resolves true when access now
   * matches `enabled`, false when the user denied the request.
   */
  async function setCampusAccess(api, campuses, campus, enabled) {
    const origins = [campuses.originFor(campus)];
    if (enabled) {
      if (!(await api.permissions.request({ origins }))) {
        return false;
      }
      try {
        await registerCampusScript(api, campuses, campus);
      } catch (error) {
        await api.permissions.remove({ origins }).catch(() => {});
        throw error;
      }
      return true;
    }

    await unregisterCampusScript(api, campus);
    await api.permissions.remove({ origins });
    return true;
  }

  function mergeSettings(campuses, stored) {
    const merged = campuses.defaultCampusSettings();
    if (stored && typeof stored === "object") {
      for (const [id, value] of Object.entries(stored)) merged[id] = { ...merged[id], ...value };
    }
    return merged;
  }

  /**
   * Makes every runtime campus registered exactly when it is enabled AND its
   * host is granted. An enabled campus whose permission is gone is turned off.
   */
  async function reconcileCampusAccess(api, campuses) {
    if (!api.scripting?.getRegisteredContentScripts || !api.permissions?.contains) return;
    const { campuses: stored } = await api.storage.sync.get("campuses");
    const settings = mergeSettings(campuses, stored);
    const ids = await registeredIds(api);
    let changed = false;

    for (const campus of campuses.list) {
      if (campus.staticScript) continue;
      const enabled = Boolean(settings[campus.id]?.enabled);
      const granted = await api.permissions.contains({ origins: [campuses.originFor(campus)] });
      const registered = ids.has(scriptIdFor(campus));

      if (enabled && granted && !registered) {
        await registerCampusScript(api, campuses, campus);
      } else if (!(enabled && granted) && registered) {
        await api.scripting.unregisterContentScripts({ ids: [scriptIdFor(campus)] });
      }
      if (enabled && !granted) {
        settings[campus.id] = { ...settings[campus.id], enabled: false };
        changed = true;
      }
    }

    if (changed) await api.storage.sync.set({ campuses: settings });
  }

  /** The user removed host access in the browser's own UI. */
  async function handlePermissionsRemoved(api, campuses, removed) {
    const origins = new Set(removed?.origins ?? []);
    const affected = campuses.list.filter((campus) => !campus.staticScript && origins.has(campuses.originFor(campus)));
    if (!affected.length) return;

    const { campuses: stored } = await api.storage.sync.get("campuses");
    const settings = mergeSettings(campuses, stored);
    for (const campus of affected) {
      await unregisterCampusScript(api, campus);
      settings[campus.id] = { ...settings[campus.id], enabled: false };
    }
    await api.storage.sync.set({ campuses: settings });
  }

  root.PROFCHECK_CAMPUS_ACCESS = Object.freeze({
    scriptIdFor,
    setCampusAccess,
    reconcileCampusAccess,
    handlePermissionsRemoved
  });
})(globalThis);
