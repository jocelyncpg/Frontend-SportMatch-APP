const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
function load(handler = async () => ({ items: [], next_cursor: null })) {
  const auth = { session: { id: 'a' }, token: 'token-a' }; const calls = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/activities.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date, Error,
    require(name) {
      if (name === './auth') return { getSession: async () => auth.session, getToken: async () => auth.token };
      if (name === './api') return { ApiError, apiRequest: async (...args) => { calls.push(args); return handler(...args); } };
      throw Error(name);
    },
  });
  return { api: module.exports, auth, calls };
}
test('activities are loaded from the API with pagination and no demo fallback', async () => {
  const { api, calls } = load(); const result = await api.listActivities(3, 'cursor');
  assert.equal(result.items.length, 0);
  assert.equal(calls[0][0], '/activities?limit=3&cursor=cursor');
  assert.equal(calls[0][1].token, 'token-a');
});
test('publishing carries the stable retry key and uses POST', async () => {
  const { api, calls } = load(async () => ({ id: 'created' }));
  const body = { title: 'Running', sport_code: 'running', starts_at: '2030-01-01T20:00:00Z', location: 'Parque', description: '' };
  assert.equal((await api.createActivity(body, 'stable-id')).id, 'created');
  await api.createActivity(body, 'stable-id');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].body.client_activity_id, calls[1][1].body.client_activity_id);
  assert.equal(calls[0][1].body.organizer_id, undefined);
});
test('missing sessions never send requests', async () => {
  const { api, auth, calls } = load(); auth.token = null;
  await assert.rejects(api.listActivities(), (e) => e.status === 401);
  assert.equal(calls.length, 0);
});
test('account changes discard stale activity data', async () => {
  let resolve; const { api, auth } = load(() => new Promise((r) => { resolve = r; }));
  const pending = api.getActivity('id');
  await new Promise((r) => setImmediate(r)); auth.session = { id: 'b' }; resolve({ id: 'id' });
  await assert.rejects(pending, (e) => e.status === 401);
});
test('network errors are surfaced for retry', async () => {
  const { api } = load(async () => { throw Error('offline'); });
  await assert.rejects(api.listActivities(), /offline/);
});
test('date conversion preserves device local date and rejects invalid or past dates', () => {
  const { api } = load(); const year = new Date().getFullYear() + 4;
  const actual = new Date(api.activityStart(`25/12/${year}`, '19:30'));
  assert.equal(actual.getFullYear(), year); assert.equal(actual.getMonth(), 11);
  assert.equal(actual.getDate(), 25); assert.equal(actual.getHours(), 19); assert.equal(actual.getMinutes(), 30);
  for (const [date, time] of [[`31/02/${year}`, '19:30'], [`25/12/${year}`, '24:00'], ['2027-12-25', '19:00'], ['01/01/2020', '19:00']]) {
    assert.throws(() => api.activityStart(date, time));
  }
});
