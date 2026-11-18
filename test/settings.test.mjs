import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const sources = await Promise.all(['config.js', 'campuses.js', 'background.js']
  .map(name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')));

async function install(stored) {
  const settings = structuredClone(stored);
  let installListener;
  const api = {
    storage: {
      sync: {
        get: async keys => Object.fromEntries([].concat(keys).filter(k => k in settings).map(k => [k, structuredClone(settings[k])])),
        set: async value => Object.assign(settings, structuredClone(value))
      },
      session: { get: async () => ({}), set: async () => {}, clear: async () => {} }
    },
    runtime: {
      id: 'profcheck-test', getURL: p => `chrome-extension://profcheck-test/${p}`,
      onInstalled: { addListener(fn) { installListener = fn; } },
      onMessage: { addListener() {} }
    }
  };
  const context = vm.createContext({ chrome: api, URL, AbortSignal, console });
  sources.forEach(source => vm.runInContext(source, context));
  await installListener({ reason: stored && Object.keys(stored).length ? 'update' : 'install' });
  return { settings, defaults: context.PROFCHECK_DEFAULTS };
}

// 0.2.0 stored exactly these keys after its own onInstalled.
const V020_KEYS = ['universityName', 'courseRowSelector', 'instructorSelector', 'courseCodeSelector', 'showRmp',
  'showCougarGrades', 'darkMode', 'defaultScoringMode', 'rmpStrictSearch', 'cougarGradesBaseUrl',
  'cougarGradesApiBaseUrl', 'rmpProfessorBaseUrl'];

test('a fresh install stores every default and turns UH on', async () => {
  const { settings, defaults } = await install({});
  for (const [key, value] of Object.entries(defaults)) assert.deepEqual(settings[key], value);
  assert.deepEqual(settings.campuses, { uh: { enabled: true } });
});

test('upgrading from 0.2.0 defaults keeps every value and adds UH as enabled', async () => {
  const { defaults } = await install({});
  const v020 = Object.fromEntries(V020_KEYS.map(key => [key, defaults[key]]));
  const { settings } = await install(v020);
  for (const key of V020_KEYS) assert.deepEqual(settings[key], v020[key]);
  assert.deepEqual(settings.campuses, { uh: { enabled: true } });
});

test('upgrading from 0.2.0 with custom selectors and toggles preserves all of them', async () => {
  const custom = {
    courseRowSelector: 'tr.custom-row',
    instructorSelector: 'span.custom-instructor',
    courseCodeSelector: 'span.custom-code',
    universityName: 'University of Houston-Downtown',
    showRmp: false,
    showCougarGrades: false,
    darkMode: true,
    defaultScoringMode: 'easiestA',
    rmpStrictSearch: false
  };
  const { settings } = await install(custom);
  for (const [key, value] of Object.entries(custom)) assert.deepEqual(settings[key], value);
  assert.deepEqual(settings.campuses, { uh: { enabled: true } });
});

test('a campus the user turned off stays off after an update', async () => {
  const { settings } = await install({ showRmp: true, campuses: { uh: { enabled: false } } });
  assert.deepEqual(settings.campuses, { uh: { enabled: false } });
});
