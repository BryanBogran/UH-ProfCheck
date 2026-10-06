document.getElementById("open-dialog").addEventListener("click", () => document.getElementById("class-dialog").showModal());
document.getElementById("replace-results").addEventListener("click", () => {
  const results = document.getElementById("class-options");
  const replacement = results.cloneNode(true);
  replacement.querySelectorAll(".prof-overlay-host").forEach((host) => host.remove());
  results.replaceWith(replacement);
});
