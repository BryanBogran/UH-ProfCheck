// Fails when a manifest does not parse or names a runtime file that does not exist.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

for (const name of ["manifest.json", "manifest.firefox.json"]) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(ROOT, name), "utf8"));
  } catch (error) {
    problems.push(`${name}: does not parse (${error.message})`);
    continue;
  }
  const files = [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    manifest.options_page,
    ...Object.values(manifest.icons ?? {}),
    ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])])
  ].filter(Boolean);
  for (const file of files) {
    if (!existsSync(join(ROOT, file))) problems.push(`${name}: missing file ${file}`);
  }
}

if (problems.length) {
  problems.forEach((problem) => console.error(problem));
  process.exit(1);
}
console.log("Manifests OK");
