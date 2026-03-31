const SUPPORT_EMAIL = "flamezbb1@gmail.com";
const RATE_LINKS = {
  chromium: "https://chromewebstore.google.com/detail/uh-profcheck/cgddcdnkcckjknijkaopgmhahbcdjjai?authuser=0&hl=en",
  firefox: ""
};

function detectBrowser() {
  const ua = navigator.userAgent;

  if (/Firefox\//.test(ua)) {
    return "firefox";
  }

  if (/Brave\//.test(ua) || /Edg\//.test(ua) || /Chrome\//.test(ua)) {
    return "chromium";
  }

  return "chromium";
}

function getSupportEmailUrl(subject) {
  const url = new URL(`mailto:${SUPPORT_EMAIL}`);
  if (subject) {
    url.searchParams.set("subject", subject);
  }
  return url.toString();
}

function getRateLink() {
  const browser = detectBrowser();
  return RATE_LINKS[browser] || "";
}

function setLink(nodeId, url, fallbackLabel) {
  const node = document.getElementById(nodeId);
  if (!node) {
    return;
  }

  if (url) {
    node.href = url;
    return;
  }

  node.removeAttribute("href");
  node.setAttribute("aria-disabled", "true");
  node.classList.add("action--disabled");
  if (fallbackLabel) {
    node.textContent = fallbackLabel;
  }
}

function setText(nodeId, value) {
  const node = document.getElementById(nodeId);
  if (node) {
    node.textContent = value;
  }
}

function initPage() {
  const page = document.body?.dataset?.page;

  if (page === "support") {
    const supportUrl = getSupportEmailUrl("UH ProfCheck support");
    setLink("support-email-link", supportUrl);
    setText("support-email-text", SUPPORT_EMAIL);
    return;
  }

  if (page === "feedback") {
    setLink("feedback-email-link", getSupportEmailUrl("UH ProfCheck feedback"));
    return;
  }

  if (page === "rate") {
    const rateUrl = getRateLink();
    setLink("rate-link", rateUrl, "Rate page not configured");
    setLink("rate-email-link", getSupportEmailUrl("UH ProfCheck review"));
    if (rateUrl) {
      setText("rate-note", "The button above opens the review page for the current browser.");
    }
  }
}

document.addEventListener("DOMContentLoaded", initPage);
