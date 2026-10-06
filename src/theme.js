/** Independent of professor lookups so theming also works in enrollment dialogs. */
(async function initEnrollmentTheme() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const THEME_CLASS = "profcheck-dark";

  // Register before reading storage so a setting changed during startup wins.
  let settingChanged = false;
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.darkMode) {
      return;
    }
    settingChanged = true;
    applyTheme(changes.darkMode.newValue);
  });

  const settings = await extensionApi.storage.sync.get("darkMode");
  if (!settingChanged) {
    applyTheme(settings.darkMode);
  }

  function applyTheme(darkMode) {
    document.documentElement.classList.toggle(THEME_CLASS, darkMode === true);
  }
})();
