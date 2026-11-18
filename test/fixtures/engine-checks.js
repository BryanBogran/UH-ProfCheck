// Tiny check runner shared by the engine-*.html fixtures. Each page calls
// runEngineChecks([[name, fn], ...]); results land in #summary[data-failed].
window.runEngineChecks = async (checks) => {
  const summary = document.querySelector("#summary");
  const list = document.querySelector("#checks");
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame); };
  let passed = 0, failed = 0;
  for (const [name, fn] of checks) {
    const item = document.createElement("li");
    try {
      await settle();
      await fn({ settle });
      item.className = "pass";
      item.textContent = `PASS · ${name}`;
      passed++;
    } catch (error) {
      item.className = "fail";
      item.textContent = `FAIL · ${name}: ${error.message}`;
      failed++;
    }
    list.append(item);
  }
  summary.textContent = `${passed} engine checks passed · ${failed} failed`;
  summary.dataset.failed = String(failed);
};

window.expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
