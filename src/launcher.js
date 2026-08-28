/**
 * Floating, draggable launcher: the in-page scoring-mode switcher.
 * Self-contained — it shares no state with the section overlay, and reaches the
 * overlay only by writing defaultScoringMode, which the overlay already watches.
 */
(async function initLauncher() {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const { SCORING_MODES } = globalThis.PROFCHECK_SCORING;
  const DEFAULT_MODE = globalThis.PROFCHECK_DEFAULTS.defaultScoringMode;
  const LAUNCHER_POSITION_KEY = "launcherPosition";
  const DRAG_THRESHOLD_PX = 4;

  let activeMode = (await extensionApi.storage.sync.get("defaultScoringMode")).defaultScoringMode;
  if (!SCORING_MODES[activeMode]) {
    activeMode = DEFAULT_MODE;
  }

  await createLauncher();

  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.defaultScoringMode) {
      activeMode = changes.defaultScoringMode.newValue;
      syncLauncherMode();
    }
  });

async function createLauncher() {
  const panel = document.createElement("div");
  panel.className = "profcheck-panel";
  panel.hidden = true;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "profcheck-launcher__toggle";
  toggle.setAttribute("aria-label", "UH ProfCheck: open ranking options");
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
  Object.entries(SCORING_MODES).forEach(([mode, { label }]) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "profcheck-panel__mode";
    option.dataset.mode = mode;
    option.textContent = label;
    // Writing to sync fires applyChangedSettings, which re-ranks in place.
    option.addEventListener("click", () => extensionApi.storage.sync.set({ defaultScoringMode: mode }));
    modes.append(option);
  });

  content.append(header, modes);
  return content;
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
  if (!position) {
    return;
  }

  // Keep it reachable after a resize or a zoom change.
  const maxLeft = Math.max(0, window.innerWidth - launcher.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - launcher.offsetHeight);
  launcher.style.left = `${Math.min(maxLeft, Math.max(0, position.left))}px`;
  launcher.style.top = `${Math.min(maxTop, Math.max(0, position.top))}px`;
  launcher.style.right = "auto";
  launcher.style.bottom = "auto";
}
})();
