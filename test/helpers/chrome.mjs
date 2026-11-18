// Drives headless Chrome over the DevTools protocol with no npm dependencies.
// Tests that need a real DOM call launchChrome(); it returns null when no
// Chrome is installed so those tests can skip with a clear reason.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

export function findChrome() {
  return CANDIDATES.find((path) => existsSync(path)) ?? null;
}

export async function launchChrome() {
  const executable = findChrome();
  if (!executable) {
    return null;
  }

  const profile = mkdtempSync(join(tmpdir(), "profcheck-chrome-"));
  const chrome = spawn(executable, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--no-sandbox", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const wsUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Chrome did not start: ${output}`)), 15000);
    chrome.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited with ${code}: ${output}`)));
  });

  const { port } = new URL(wsUrl);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  const loadWaiters = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Page.loadEventFired") {
      loadWaiters.splice(0).forEach((resolve) => resolve());
    }
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      callback(message);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
    socket.send(JSON.stringify({ id, method, params }));
  });

  await send("Page.enable");

  return {
    async open(url) {
      const loaded = new Promise((resolve) => loadWaiters.push(resolve));
      await send("Page.navigate", { url });
      await loaded;
    },

    /** Evaluates an expression in the page and returns its JSON value; page errors throw. */
    async evaluate(expression) {
      const { result, exceptionDetails } = await send("Runtime.evaluate", {
        expression, returnByValue: true, awaitPromise: true
      });
      if (exceptionDetails) {
        throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      }
      return result.value;
    },

    /** Polls an expression until it returns something other than null/undefined. */
    async waitFor(expression, timeoutMs = 15000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const value = await this.evaluate(expression);
        if (value != null) return value;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting for ${expression}`);
    },

    async close() {
      socket.close();
      if (chrome.exitCode === null && chrome.signalCode === null) {
        const exited = new Promise((resolve) => chrome.once("exit", resolve));
        chrome.kill();
        await exited;
      }
      // Chrome's helper processes can still be flushing the profile after exit.
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      } catch {
        // A leftover temp profile is harmless; the OS cleans its temp dir.
      }
    }
  };
}
