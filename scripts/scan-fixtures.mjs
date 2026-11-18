// Fails when a campus fixture looks like it contains real student or session data.
// Fixtures must be hand-built with made-up values; see CONTRIBUTING.md.
// To allow a specific harmless number, add `<!-- scan-allow: 1234567 -->` to the file.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_ROOT = join(ROOT, "test", "fixtures", "campuses");

const ID_PATTERN = /(?<![\d.])\d{6,}(?![\d.])/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const SESSION_PARAM_PATTERN = /[?&;](ICSID|PSJSESSIONID|token|sid|session|SAMLResponse)=/i;
const HIDDEN_INPUT_PATTERN = /<input\b[^>]*>/gi;
const SCRIPT_PATTERN = /<script\b/i;
const ALLOW_PATTERN = /scan-allow:\s*([\d\s,]+)/g;

/** Returns findings for one file's text as [{ line, reason }]. */
export function scanText(text) {
  const allowed = new Set();
  for (const match of text.matchAll(ALLOW_PATTERN)) {
    match[1].split(/[\s,]+/).filter(Boolean).forEach((value) => allowed.add(value));
  }

  const findings = [];
  text.split("\n").forEach((line, index) => {
    const add = (reason) => findings.push({ line: index + 1, reason });
    if (ALLOW_PATTERN.test(line)) {
      ALLOW_PATTERN.lastIndex = 0;
      return;
    }
    ALLOW_PATTERN.lastIndex = 0;

    for (const [digits] of line.matchAll(ID_PATTERN)) {
      if (!/^0+$/.test(digits) && !allowed.has(digits)) add(`number that looks like a student ID: ${digits}`);
    }
    for (const [email, domain] of line.matchAll(EMAIL_PATTERN)) {
      if (domain.toLowerCase() !== "example.edu") add(`email address: ${email}`);
    }
    const session = line.match(SESSION_PARAM_PATTERN);
    if (session) add(`session or token URL parameter: ${session[1]}`);
    for (const [tag] of line.matchAll(HIDDEN_INPUT_PATTERN)) {
      const isHidden = /\btype\s*=\s*["']?hidden\b/i.test(tag);
      const value = tag.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      if (isHidden && value && (value[1] ?? value[2] ?? value[3]).trim()) add("hidden input with a value");
    }
    if (SCRIPT_PATTERN.test(line)) add("<script> tag");
  });
  return findings;
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Scans every file under `directory`; returns [{ file, line, reason }]. */
export function scanDirectory(directory = FIXTURE_ROOT) {
  if (!existsSync(directory)) return [];
  return listFiles(directory).flatMap((file) =>
    scanText(readFileSync(file, "utf8")).map((finding) => ({ file, ...finding })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2] ? join(process.cwd(), process.argv[2]) : FIXTURE_ROOT;
  if (!existsSync(directory)) {
    console.log(`No campus fixtures at ${relative(ROOT, directory)}; nothing to scan.`);
    process.exit(0);
  }
  const findings = scanDirectory(directory);
  findings.forEach(({ file, line, reason }) => console.error(`${relative(ROOT, file)}:${line}: ${reason}`));
  if (findings.length) {
    console.error(`\n${findings.length} possible real-data finding(s). Replace them with made-up values.`);
    process.exit(1);
  }
  console.log(`Campus fixtures clean (${relative(ROOT, directory)}).`);
}
