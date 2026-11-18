import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [campusesSource, accessSource, manifestText, firefoxText] = await Promise.all([
  read('src/campuses.js'), read('src/campus-access.js'), read('manifest.json'), read('manifest.firefox.json')
]);

function load() {
  const context = vm.createContext({ URL });
  vm.runInContext(campusesSource, context);
  vm.runInContext(accessSource, context);
  return { real: context.PROFCHECK_CAMPUSES, access: context.PROFCHECK_CAMPUS_ACCESS };
}

const { real, access } = load();

// Only UH exists today, so tests inject a fake runtime campus alongside it.
const PILOT = { id: 'pilot', displayName: 'Pilot College', host: 'reg.pilot.example.edu', allFrames: true, staticScript: false, defaultEnabled: false };
const FAKE = {
  list: [real.byId('uh'), PILOT],
  originFor: real.originFor,
  contentScriptFilesFor: real.contentScriptFilesFor,
  contentStyles: real.contentStyles,
  defaultCampusSettings: () => ({ uh: { enabled: true }, pilot: { enabled: false } })
};
const PILOT_ORIGIN = 'https://reg.pilot.example.edu/*';

function fakeApi({ grant = true, granted = [], registered = [], campuses, rejectPersist = false } = {}) {
  const state = {
    granted: new Set(granted),
    scripts: new Map(registered.map(id => [id, { id }])),
    settings: campuses ? { campuses: structuredClone(campuses) } : {},
    requests: 0,
    calls: []
  };
  const api = {
    permissions: {
      request: async ({ origins }) => { state.requests += 1; if (grant) origins.forEach(o => state.granted.add(o)); return grant; },
      remove: async ({ origins }) => { origins.forEach(o => state.granted.delete(o)); return true; },
      contains: async ({ origins }) => origins.every(o => state.granted.has(o))
    },
    scripting: {
      getRegisteredContentScripts: async () => [...state.scripts.values()],
      registerContentScripts: async scripts => {
        if (rejectPersist && scripts.some(s => s.persistAcrossSessions)) throw new Error('persistAcrossSessions is not supported');
        state.calls.push(['register', scripts]);
        scripts.forEach(s => state.scripts.set(s.id, s));
      },
      updateContentScripts: async scripts => { state.calls.push(['update', scripts]); scripts.forEach(s => state.scripts.set(s.id, s)); },
      unregisterContentScripts: async ({ ids }) => { state.calls.push(['unregister', ids]); ids.forEach(id => state.scripts.delete(id)); }
    },
    storage: {
      sync: {
        get: async key => (key in state.settings ? { [key]: structuredClone(state.settings[key]) } : {}),
        set: async value => Object.assign(state.settings, structuredClone(value))
      }
    }
  };
  return { api, state };
}

test('the shared script list matches the UH manifest entry with only the adapter swapped', () => {
  for (const text of [manifestText, firefoxText]) {
    const manifest = JSON.parse(text);
    const engine = manifest.content_scripts.find(entry => entry.js.includes('src/content.js'));
    assert.deepEqual([...real.contentScriptFilesFor(real.byId('uh'))], engine.js);
    assert.deepEqual([...real.contentStyles], engine.css);
  }
  const pilotFiles = [...real.contentScriptFilesFor(PILOT)];
  assert.ok(pilotFiles.includes('src/adapters/pilot.js'));
  assert.ok(!pilotFiles.includes('src/adapters/uh.js'));
});

test('both manifests add scripting and an empty optional host list, keeping UH static', () => {
  for (const text of [manifestText, firefoxText]) {
    const manifest = JSON.parse(text);
    assert.ok(manifest.permissions.includes('scripting'));
    assert.deepEqual(manifest.optional_host_permissions, []);
    assert.deepEqual(manifest.host_permissions, ['https://api.cougargrades.io/*']);
  }
});

test('enabling a granted campus registers its script with the campus settings', async () => {
  const { api, state } = fakeApi();
  assert.equal(await access.setCampusAccess(api, FAKE, PILOT, true), true);
  assert.ok(state.granted.has(PILOT_ORIGIN));
  const script = state.scripts.get('campus-pilot');
  assert.deepEqual([...script.matches], [PILOT_ORIGIN]);
  assert.equal(script.allFrames, true);
  assert.equal(script.runAt, 'document_idle');
  assert.equal(script.persistAcrossSessions, true);
  assert.ok(script.js.includes('src/adapters/pilot.js'));
  assert.deepEqual([...script.css], ['src/content.css']);
});

test('permissions.request runs before any other await so the click gesture is kept', async () => {
  const { api, state } = fakeApi();
  const pending = access.setCampusAccess(api, FAKE, PILOT, true);
  assert.equal(state.requests, 1, 'request must be called synchronously');
  await pending;
});

test('a denied request leaves the campus unregistered', async () => {
  const { api, state } = fakeApi({ grant: false });
  assert.equal(await access.setCampusAccess(api, FAKE, PILOT, true), false);
  assert.equal(state.scripts.size, 0);
  assert.equal(state.granted.size, 0);
});

test('a failed registration gives the permission back', async () => {
  const { api, state } = fakeApi();
  api.scripting.registerContentScripts = async () => { throw new Error('boom'); };
  await assert.rejects(access.setCampusAccess(api, FAKE, PILOT, true), /boom/);
  assert.equal(state.granted.size, 0);
});

test('browsers without persistent registration fall back to per-session scripts', async () => {
  const { api, state } = fakeApi({ rejectPersist: true });
  assert.equal(await access.setCampusAccess(api, FAKE, PILOT, true), true);
  assert.equal(state.scripts.get('campus-pilot').persistAcrossSessions, false);
});

test('enabling an already registered campus updates instead of registering twice', async () => {
  const { api, state } = fakeApi({ registered: ['campus-pilot'] });
  await access.setCampusAccess(api, FAKE, PILOT, true);
  assert.deepEqual(state.calls.map(([kind]) => kind), ['update']);
});

test('disabling unregisters the script and removes the permission', async () => {
  const { api, state } = fakeApi({ granted: [PILOT_ORIGIN], registered: ['campus-pilot'] });
  assert.equal(await access.setCampusAccess(api, FAKE, PILOT, false), true);
  assert.equal(state.scripts.size, 0);
  assert.equal(state.granted.size, 0);
});

test('startup reconcile registers an enabled, granted campus that lost its script', async () => {
  const { api, state } = fakeApi({ granted: [PILOT_ORIGIN], campuses: { uh: { enabled: true }, pilot: { enabled: true } } });
  await access.reconcileCampusAccess(api, FAKE);
  assert.ok(state.scripts.has('campus-pilot'));
  assert.equal(state.settings.campuses.pilot.enabled, true);
});

test('startup reconcile removes a script for a disabled campus', async () => {
  const { api, state } = fakeApi({ granted: [PILOT_ORIGIN], registered: ['campus-pilot'], campuses: { pilot: { enabled: false } } });
  await access.reconcileCampusAccess(api, FAKE);
  assert.equal(state.scripts.size, 0);
});

test('startup reconcile turns off an enabled campus whose permission is gone', async () => {
  const { api, state } = fakeApi({ registered: ['campus-pilot'], campuses: { uh: { enabled: true }, pilot: { enabled: true } } });
  await access.reconcileCampusAccess(api, FAKE);
  assert.equal(state.scripts.size, 0);
  assert.equal(state.settings.campuses.pilot.enabled, false);
  assert.equal(state.settings.campuses.uh.enabled, true);
});

test('startup reconcile never registers the static UH campus', async () => {
  const { api, state } = fakeApi({ campuses: { uh: { enabled: true } } });
  await access.reconcileCampusAccess(api, FAKE);
  assert.equal(state.scripts.size, 0);
  assert.deepEqual(state.calls, []);
});

test('revoking access in the browser unregisters and turns the campus off', async () => {
  const { api, state } = fakeApi({ registered: ['campus-pilot'], campuses: { uh: { enabled: true }, pilot: { enabled: true } } });
  await access.handlePermissionsRemoved(api, FAKE, { origins: [PILOT_ORIGIN] });
  assert.equal(state.scripts.size, 0);
  assert.equal(state.settings.campuses.pilot.enabled, false);
  assert.equal(state.settings.campuses.uh.enabled, true);
});

test('removing an unrelated origin changes nothing', async () => {
  const { api, state } = fakeApi({ registered: ['campus-pilot'], campuses: { pilot: { enabled: true } } });
  await access.handlePermissionsRemoved(api, FAKE, { origins: ['https://elsewhere.example.com/*'] });
  assert.ok(state.scripts.has('campus-pilot'));
  assert.equal(state.settings.campuses.pilot.enabled, true);
});
