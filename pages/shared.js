const SUPPORT_EMAIL = "flamezbb1@gmail.com";
const RATE_LINKS = {
  chromium: "https://chromewebstore.google.com/detail/uh-profcheck/cgddcdnkcckjknijkaopgmhahbcdjjai?authuser=0&hl=en",
  firefox: ""
};

const PAGE_INITIALIZERS = {
  support: initSupportPage,
  feedback: initFeedbackPage,
  rate: initRatePage
};

document.addEventListener("DOMContentLoaded", () => {
  PAGE_INITIALIZERS[document.body.dataset.page]?.();
});

function initSupportPage() {
  setLink("support-email-link", supportEmailUrl("UH ProfCheck support"));
  setText("support-email-text", SUPPORT_EMAIL);
}

function initFeedbackPage() {
  setLink("feedback-email-link", supportEmailUrl("UH ProfCheck feedback"));
}

function initRatePage() {
  const rateUrl = RATE_LINKS[detectBrowser()];

  setLink("rate-link", rateUrl);
  setLink("rate-email-link", supportEmailUrl("UH ProfCheck review"));
  setText("rate-note", rateUrl
    ? "The button above opens the review page for the current browser."
    : "There is no store listing for this browser yet, so send a note instead.");

  if (!rateUrl) {
    setText("rate-label", "Rating unavailable");
  }
}

function detectBrowser() {
  return /Firefox\//.test(navigator.userAgent) ? "firefox" : "chromium";
}

/** RFC 6068 wants %20 in a mailto subject; URLSearchParams would write "+". */
function supportEmailUrl(subject) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** Without a destination the anchor becomes an inert, non-focusable label. */
function setLink(nodeId, url) {
  const node = document.getElementById(nodeId);
  if (url) {
    node.href = url;
    return;
  }

  node.removeAttribute("href");
  node.setAttribute("aria-disabled", "true");
  node.classList.add("action--disabled");
}

function setText(nodeId, value) {
  document.getElementById(nodeId).textContent = value;
}
