/**
 * Floating, draggable launcher: ranking and enrollment appearance controls.
 * Self-contained — it shares no state with the section overlay, and reaches the
 * overlay and page theme by writing their shared sync-storage preferences.
 */
(async function initLauncher() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const { SCORING_MODES } = globalThis.PROFCHECK_SCORING;
  const DEFAULT_MODE = globalThis.PROFCHECK_DEFAULTS.defaultScoringMode;
  const LAUNCHER_POSITION_KEY = "launcherPosition";
  const DRAG_THRESHOLD_PX = 4;

  let activeMode = DEFAULT_MODE;
  let darkMode = false;
  const changedDuringStartup = new Set();
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.defaultScoringMode) {
      changedDuringStartup.add("defaultScoringMode");
      const mode = changes.defaultScoringMode.newValue;
      activeMode = SCORING_MODES[mode] ? mode : DEFAULT_MODE;
      syncLauncherMode();
    }
    if (areaName === "sync" && changes.darkMode) {
      changedDuringStartup.add("darkMode");
      darkMode = changes.darkMode.newValue === true;
      syncThemeToggle();
    }
  });

  const settings = await extensionApi.storage.sync.get(["defaultScoringMode", "darkMode"]);
  if (!changedDuringStartup.has("defaultScoringMode") && SCORING_MODES[settings.defaultScoringMode]) {
    activeMode = settings.defaultScoringMode;
  }
  if (!changedDuringStartup.has("darkMode")) darkMode = settings.darkMode === true;
  await createLauncher();

  async function createLauncher() {
    const panel = document.createElement("div");
    panel.className = "profcheck-panel";
    panel.hidden = true;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "profcheck-launcher__toggle";
    toggle.setAttribute("aria-label", "UH ProfCheck: open ranking and appearance options");
    toggle.setAttribute("aria-expanded", "false");

    const icon = document.createElement("img");
    icon.src = extensionApi.runtime.getURL("icons/icon-32.png");
    icon.alt = "";
    icon.draggable = false;
    toggle.append(icon);

    const launcher = document.createElement("div");
    launcher.className = "profcheck-launcher";
    launcher.append(panel, toggle);
    panel.append(buildPanelContent(panel, toggle));
    document.body.append(launcher);

    const stored = await extensionApi.storage.local.get(LAUNCHER_POSITION_KEY);
    moveLauncher(launcher, stored[LAUNCHER_POSITION_KEY]);
    makeLauncherDraggable(launcher, toggle, () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) {
        placePanel(launcher, panel);
      }
    });

    syncLauncherMode();
    syncThemeToggle();
    // Native click supports Enter/Space as well as pointer input. A drag is consumed.
    toggle.addEventListener("click", (event) => {
      if (event.detail === 0) {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) placePanel(launcher, panel);
        if (!panel.hidden) panel.querySelector(".profcheck-panel__mode").focus();
      }
    });
    launcher.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
    window.addEventListener("resize", () => moveLauncher(launcher, readLauncherRect(launcher)));
  }

  function buildPanelContent(panel, toggle) {
    const content = document.createDocumentFragment();

    const heading = document.createElement("strong");
    heading.textContent = "Rank sections by";

    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "profcheck-panel__collapse";
    collapse.setAttribute("aria-label", "Collapse panel");
    collapse.textContent = "\u00d7";
    collapse.addEventListener("click", () => {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });

    const header = document.createElement("div");
    header.className = "profcheck-panel__header";
    header.append(heading, collapse);

    const modes = document.createElement("div");
    modes.className = "profcheck-panel__modes";
    const status = document.createElement("p");
    status.className = "profcheck-panel__status";
    status.setAttribute("role", "status");
    Object.entries(SCORING_MODES).forEach(([mode, { label }]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "profcheck-panel__mode";
      option.dataset.mode = mode;
      option.textContent = label;
      // Writing to sync fires applyChangedSettings, which re-ranks in place.
      option.addEventListener("click", async () => {
        try {
          await extensionApi.storage.sync.set({ defaultScoringMode: mode });
          status.textContent = "";
        } catch {
          status.textContent = "Could not save the ranking. Please try again.";
        }
      });
      modes.append(option);
    });

    const appearance = document.createElement("label");
    appearance.className = "profcheck-panel__appearance";
    const themeLabel = document.createElement("span");
    themeLabel.textContent = "Dark mode";
    const themeToggle = document.createElement("input");
    themeToggle.type = "checkbox";
    themeToggle.className = "profcheck-panel__theme-toggle";
    themeToggle.setAttribute("role", "switch");
    themeToggle.addEventListener("change", async () => {
      themeToggle.disabled = true;
      try {
        await extensionApi.storage.sync.set({ darkMode: themeToggle.checked });
        darkMode = themeToggle.checked;
        themeToggle.setCustomValidity("");
      } catch {
        themeToggle.setCustomValidity("Could not save dark mode. Please try again.");
        themeToggle.reportValidity();
      } finally {
        themeToggle.disabled = false;
        syncThemeToggle();
      }
    });
    appearance.append(themeLabel, themeToggle);

    content.append(header, modes, appearance, status);
    return content;
  }

  function syncThemeToggle() {
    const themeToggle = document.querySelector(".profcheck-panel__theme-toggle");
    if (themeToggle) themeToggle.checked = darkMode;
  }

  function syncLauncherMode() {
    document.querySelectorAll(".profcheck-panel__mode").forEach((option) => {
      const isActive = option.dataset.mode === activeMode;
      option.classList.toggle("profcheck-panel__mode--active", isActive);
      option.setAttribute("aria-pressed", String(isActive));
    });
  }

  /** Pointer capture keeps the drag alive over the page's own handlers. */
  function makeLauncherDraggable(launcher, handle, onClick) {
    let drag = null;

    handle.addEventListener("pointerdown", (event) => {
      const { left, top } = launcher.getBoundingClientRect();
      drag = { pointerX: event.clientX, pointerY: event.clientY, left, top, moved: false };
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag) {
        return;
      }

      const offsetX = event.clientX - drag.pointerX;
      const offsetY = event.clientY - drag.pointerY;
      if (!drag.moved && Math.hypot(offsetX, offsetY) < DRAG_THRESHOLD_PX) {
        return;
      }

      drag.moved = true;
      moveLauncher(launcher, { left: drag.left + offsetX, top: drag.top + offsetY });
    });

    handle.addEventListener("pointerup", (event) => {
      if (!drag) {
        return;
      }

      handle.releasePointerCapture(event.pointerId);
      const wasDragged = drag.moved;
      drag = null;

      // A drag that ends where it started is a click, not a move.
      if (!wasDragged) {
        onClick();
        return;
      }

      extensionApi.storage.local.set({ [LAUNCHER_POSITION_KEY]: readLauncherRect(launcher) });
    });
    handle.addEventListener("pointercancel", () => { drag = null; });
  }

  /**
   * The panel is absolute against the 48px toggle, so dragging never carries it
   * off-screen. It opens toward whichever side has room, so the collapse button
   * stays reachable in every corner.
   */
  function placePanel(launcher, panel) {
    launcher.classList.remove("profcheck-launcher--flip-x", "profcheck-launcher--flip-y");

    const toggleRect = launcher.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gutter = 8;

    if (toggleRect.left < panelRect.width + gutter) {
      launcher.classList.add("profcheck-launcher--flip-x");
    }

    if (toggleRect.bottom < panelRect.height + gutter) {
      launcher.classList.add("profcheck-launcher--flip-y");
    }
  }

  function readLauncherRect(launcher) {
    const { left, top } = launcher.getBoundingClientRect();
    return { left, top };
  }

  function moveLauncher(launcher, position) {
    if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) {
      return;
    }

    // Keep it reachable after a resize or a zoom change.
    const maxLeft = Math.max(0, window.innerWidth - launcher.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - launcher.offsetHeight);
    launcher.style.left = `${Math.min(maxLeft, Math.max(0, position.left))}px`;
    launcher.style.top = `${Math.min(maxTop, Math.max(0, position.top))}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
    const panel = launcher.querySelector(".profcheck-panel");
    if (!panel.hidden) placePanel(launcher, panel);
  }
})();
