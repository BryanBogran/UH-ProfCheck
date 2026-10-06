import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const configSource = await readFile(new URL('../src/config.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/background.js', import.meta.url), 'utf8');

function startBackground({ config = {}, candidates, failRmp = false, failCg = false, firefox = false } = {}) {
  const calls = [], session = {}, errors = [];
  let listener;
  const settings = { ...config };
  const api = {
    storage: {
      sync: { get: async () => ({ ...settings }), set: async value => Object.assign(settings, value) },
      session: { get: async key => ({ [key]:session[key] }), set: async value => Object.assign(session, value), clear: async () => { for (const k of Object.keys(session)) delete session[k]; } }
    },
    runtime: { onInstalled: { addListener() {} }, onMessage: { addListener(fn) { listener = fn; } } }
  };
  const context = vm.createContext({
    [firefox ? 'browser' : 'chrome']: api,
    URL, AbortSignal,
    console: { error: (...args) => errors.push(args) },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const isRmp = url.includes('/external/rmp/');
      if ((isRmp && failRmp) || (!isRmp && failCg)) throw new Error('Network unavailable');
      const body = isRmp
        ? candidates ?? [{ school:{ name:'University of Houston' }, avgRatingRounded:4.2, numRatings:37, legacyId:321 }]
        : { meta:{ _id:'COSC 1336', fullNameLastNameFirst:'Subhlok, Jaspal' }, badges:[{key:'gpa',text:'3.08 GPA'},{key:'droprate',text:'10.31% W'}] };
      return { ok:true, json:async () => body };
    }
  });
  vm.runInContext(configSource, context);
  vm.runInContext(source, context);
  return { calls, session, errors, settings,
    send: (type, payload) => new Promise(resolve => {
      const keepAlive = listener({ type,payload }, {}, resolve);
      assert.equal(keepAlive, true);
    })
  };
}
const professor = { professorName:'Jaspal Subhlok', courseCode:'COSC 1336' };

test('Chrome and Firefox background lookups normalize representative API badge responses', async () => {
  for (const firefox of [false,true]) {
    const b = startBackground({ firefox });
    const reply = await b.send('LOOKUP_PROFESSOR',professor);
    assert.equal(reply.ok,true);
    assert.equal(reply.result.rmp.avgRating,4.2);
    assert.equal(reply.result.cougarGrades.gpa,3.08);
    assert.equal(reply.result.cougarGrades.dropRate,10.31);
    assert.match(b.calls[1].url,/Subhlok%2C%20Jaspal/);
    assert.ok(b.calls.every(c => c.options.signal instanceof AbortSignal));
  }
});
test('RMP candidates from another school never attach to a UH instructor', async () => {
  const b = startBackground({ candidates:[{school:{name:'Another University'},avgRatingRounded:5,numRatings:90,legacyId:45}] });
  const reply = await b.send('LOOKUP_PROFESSOR',professor);
  assert.equal(reply.result.rmp,null);
  assert.equal(reply.result.cougarGrades.gpa,3.08);
});
test('a failing source preserves good data and is retried instead of cached', async () => {
  for (const failures of [{failRmp:true},{failCg:true}]) {
    const b = startBackground(failures);
    const reply = await b.send('LOOKUP_PROFESSOR',professor);
    assert.equal(reply.ok,true);
    assert.equal(Object.keys(b.session).length,0);
    assert.ok(failures.failRmp ? reply.result.cougarGrades : reply.result.rmp);
    await b.send('LOOKUP_PROFESSOR',professor);
    assert.equal(b.calls.length,4);
  }
});
test('cached instructor data keeps the requested course code and avoids repeated network calls', async () => {
  const b = startBackground();
  await b.send('LOOKUP_PROFESSOR',professor);
  const reply = await b.send('LOOKUP_PROFESSOR',{...professor,courseCode:'COSC 3320'});
  assert.equal(b.calls.length,2);
  assert.equal(reply.result.courseCode,'COSC 3320');
});
test('search strictness and data toggles cannot reuse a mismatched cache entry', async () => {
  const b = startBackground();
  await b.send('LOOKUP_PROFESSOR',professor);
  b.settings.rmpStrictSearch = false;
  await b.send('LOOKUP_PROFESSOR',professor);
  assert.equal(b.calls.length,4);
  assert.match(b.calls[2].url,/strict=false/);
  b.settings.showRmp = false;
  const reply = await b.send('LOOKUP_PROFESSOR',professor);
  assert.equal(reply.result.rmp,null);
  assert.equal(b.calls.length,5);
});
test('course lookups are cached and Clear API Cache invalidates both lookup types', async () => {
  const b = startBackground();
  const first = await b.send('LOOKUP_COURSE',{courseCode:'cosc1336'});
  assert.equal(first.result.gpa,3.08);
  await b.send('LOOKUP_COURSE',{courseCode:'COSC 1336'});
  assert.equal(b.calls.length,1);
  await b.send('LOOKUP_PROFESSOR',professor);
  const clear = await b.send('CLEAR_CACHE');
  assert.equal(clear.ok,true);
  assert.equal(Object.keys(b.session).length,0);
  await b.send('LOOKUP_COURSE',{courseCode:'COSC 1336'});
  assert.equal(b.calls.length,4);
});
test('placeholder words inside a surname are preserved while actual placeholders are skipped', async () => {
  const b = startBackground();
  await b.send('LOOKUP_PROFESSOR',{professorName:'Riley Staff',courseCode:'MATH 1331'});
  assert.match(b.calls[0].url,/Riley\+Staff/);
  const count = b.calls.length;
  const reply = await b.send('LOOKUP_PROFESSOR',{professorName:'Staff'});
  assert.equal(reply.result,null);
  assert.equal(b.calls.length,count);
});
