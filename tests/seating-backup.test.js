// Synthetic fixtures and an isolated Map only. Never accesses browser/production storage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../javascript/seating_backup_core.js');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/seating-storage.json'), 'utf8'));
const origin = 'https://classroom.example';
class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); this.operations = []; this.failure = null; }
  get length() { if (this.unavailable) throw new Error('Storage unavailable'); return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { if (this.unavailable) throw new Error('Storage unavailable'); return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failure) this.failure('set', key, value);
    this.operations.push(['set', key, value]); this.data.set(key, String(value));
  }
  removeItem(key) {
    if (this.failure) this.failure('remove', key);
    this.operations.push(['remove', key]); this.data.delete(key);
  }
}
const raw = store => [...store.data].sort(([a], [b]) => a.localeCompare(b));
const backup = entries => core.envelope(Object.entries(entries).map(([key, value]) => ({ key, value })), origin);

test('all five namespaces include legacy/orphaned records and exclude unrelated entries', () => {
  const store = new MemoryStorage({ ...fixtures.classrooms, preferences: 'keep', [core.JOURNAL_KEY]: 'internal' });
  const exported = core.capture(store, origin);
  assert.equal(exported.entries.length, Object.keys(fixtures.classrooms).length);
  assert.deepEqual(Object.fromEntries(exported.entries.map(e => [e.key, e.value])), fixtures.classrooms);
  assert.equal(store.operations.length, 0);
});
test('empty storage exports a valid versioned, timestamped envelope without writes', () => {
  const store = new MemoryStorage(fixtures.empty);
  const result = core.capture(store, origin);
  assert.equal(result.format, core.FORMAT); assert.equal(result.version, 1);
  assert.ok(Number.isFinite(Date.parse(result.createdAt))); assert.equal(result.sourceOrigin, origin);
  assert.deepEqual(result.entries, []); assert.equal(store.operations.length, 0);
});
test('opening capture is independent of later migrations and edits', () => {
  const store = new MemoryStorage(fixtures.classrooms);
  const opening = core.capture(store, origin);
  store.setItem('tableLayouts', '{"migration":"later"}');
  store.setItem('seatingChartData_default', '{"newer":"edit"}');
  assert.equal(opening.entries.find(e => e.key === 'tableLayouts').value, fixtures.classrooms.tableLayouts);
  assert.equal(opening.entries.find(e => e.key === 'seatingChartData_default').value, fixtures.classrooms.seatingChartData_default);
});
test('malformed JSON, whitespace, Unicode and unknown fields survive exact round trips', () => {
  const source = new MemoryStorage({ ...fixtures.classrooms, ...fixtures.malformed, ...fixtures.unknown });
  const exported = JSON.stringify(core.capture(source, origin));
  const destination = new MemoryStorage({ unrelated: 'untouched' });
  const original = core.readEntries(source);
  core.restore(destination, exported);
  assert.deepEqual(core.readEntries(destination), original);
  assert.equal(destination.getItem('unrelated'), 'untouched');
  assert.equal(destination.getItem(core.JOURNAL_KEY), null);
  assert.equal(source.operations.length, 0);
});
test('preview counts distinguish new, replaced, identical, and retained items', () => {
  const store = new MemoryStorage({ classList: 'old', tableLayouts: '{}', seatingChartData_keep: 'raw', theme: 'blue' });
  const plan = core.planRestore(store, backup({ classList: 'new', tableLayouts: '{}', seatingChartData_added: 'raw' }));
  assert.deepEqual([plan.added, plan.replaced, plan.identical, plan.retained, plan.unchanged], [1, 1, 1, 1, 2]);
  assert.equal(store.operations.length, 0);
});
test('cancelling after preview and parsing a file make no storage changes', () => {
  const store = new MemoryStorage(fixtures.classrooms); const before = raw(store);
  core.planRestore(store, JSON.stringify(backup(fixtures.unknown)));
  assert.deepEqual(raw(store), before); assert.deepEqual(store.operations, []);
});
test('empty backup does not delete records; identical restore does not create a journal', () => {
  const store = new MemoryStorage(fixtures.classrooms); const before = raw(store);
  core.restore(store, backup({})); core.restore(store, core.capture(store, origin));
  assert.deepEqual(raw(store), before); assert.deepEqual(store.operations, []);
});
test('unavailable storage fails capture/preview without writes', () => {
  const store = new MemoryStorage(fixtures.classrooms); store.unavailable = true;
  assert.throws(() => core.capture(store, origin), /unavailable/);
  assert.throws(() => core.planRestore(store, backup({})), /unavailable/);
  assert.deepEqual(store.operations, []);
});
test('unsupported and unsafe envelopes are rejected without modifying any data', () => {
  const good = backup({ classList: 'raw' });
  const invalid = [null, {}, [], 'not JSON', { ...good, version: 2 }, { ...good, format: 'other' },
    { ...good, createdAt: 'invalid' }, { ...good, sourceOrigin: 'javascript:alert(1)' },
    { ...good, sourceOrigin: 'https://classroom.example/path' }, { ...good, entries: {} },
    { ...good, entries: [{ key: 'classList', value: [] }] },
    { ...good, entries: [{ key: 'theme', value: 'bad' }] },
    { ...good, entries: [{ key: core.JOURNAL_KEY, value: 'bad' }] },
    { ...good, entries: [{ key: 'classList', value: 'a' }, { key: 'classList', value: 'b' }] }];
  for (const value of invalid) {
    const store = new MemoryStorage(fixtures.classrooms); const before = raw(store);
    assert.throws(() => core.restore(store, value));
    assert.deepEqual(raw(store), before); assert.deepEqual(store.operations, []);
  }
});
test('file origin is represented explicitly by null-origin string', () => {
  assert.equal(core.capture(new MemoryStorage(), 'null').sourceOrigin, 'null');
});
test('changed data invalidates a stale preview before any writes', () => {
  const store = new MemoryStorage({ classList: 'original' });
  const incoming = backup({ classList: 'replacement' });
  const plan = core.planRestore(store, incoming);
  store.setItem('classList', 'other-tab'); store.operations = [];
  assert.throws(() => core.restore(store, incoming, plan.before), /changed after/);
  assert.equal(store.getItem('classList'), 'other-tab'); assert.deepEqual(store.operations, []);
});
test('journal quota failure prevents any classroom writes', () => {
  const store = new MemoryStorage(fixtures.classrooms); const before = raw(store);
  store.failure = (_, key) => { if (key === core.JOURNAL_KEY) throw new Error('Quota exceeded'); };
  assert.throws(() => core.restore(store, backup(fixtures.unknown)), /Quota/);
  assert.deepEqual(raw(store), before); assert.deepEqual(store.operations, []);
});
test('failure midway rolls back replacements and removes newly added records', () => {
  const store = new MemoryStorage({ classList: 'old', theme: 'keep' }); const before = raw(store);
  let failed = false;
  store.failure = (kind, key) => {
    if (!failed && kind === 'set' && key === 'tableLayouts') { failed = true; throw new Error('Injected write failure'); }
  };
  assert.throws(() => core.restore(store, backup({ classList: 'new', seatingChartData_added: 'raw', tableLayouts: '{}' })), error => error.rolledBack === true);
  assert.deepEqual(raw(store), before); assert.equal(store.getItem(core.JOURNAL_KEY), null);
});
test('failure deleting the completed journal also returns to original data', () => {
  const store = new MemoryStorage({ classList: 'old' }); const before = raw(store); let failed = false;
  store.failure = (kind, key) => {
    if (!failed && kind === 'remove' && key === core.JOURNAL_KEY) { failed = true; throw new Error('Cleanup failed'); }
  };
  assert.throws(() => core.restore(store, backup({ classList: 'new' })), error => error.rolledBack === true);
  assert.deepEqual(raw(store), before);
});
test('persistent failure retains the before-image; explicit later recovery restores it exactly', () => {
  const store = new MemoryStorage({ classList: 'old', theme: 'keep' }); const before = core.readEntries(store);
  let broken = false;
  store.failure = (kind, key) => {
    if (kind === 'set' && key === 'tableLayouts') broken = true;
    if (broken) throw new Error('Storage stopped accepting writes');
  };
  assert.throws(() => core.restore(store, backup({ classList: 'new', tableLayouts: '{}' })), error => error.recoveryPending === true);
  assert.deepEqual(core.readJournal(store).before, before);
  assert.throws(() => core.restore(store, backup({})), /earlier recovery/);
  store.failure = null;
  core.recover(store);
  assert.deepEqual(core.readEntries(store), before); assert.equal(store.getItem('theme'), 'keep');
  assert.equal(store.getItem(core.JOURNAL_KEY), null); core.recover(store);
});
test('recovery does not overwrite a different value from another tab', () => {
  const store = new MemoryStorage({ classList: 'another-tab', [core.JOURNAL_KEY]: JSON.stringify({
    format: 'chriswellsdev-seating-recovery', version: 1,
    before: [{ key: 'classList', value: 'original' }], writes: [{ key: 'classList', value: 'restored' }]
  }) });
  assert.throws(() => core.recover(store), error => error.recoveryPending === true);
  assert.equal(store.getItem('classList'), 'another-tab'); assert.ok(store.getItem(core.JOURNAL_KEY));
});
test('unknown or malformed recovery notes are rejected, never automatically discarded', () => {
  for (const value of ['{broken', JSON.stringify({ format: 'unknown', version: 1 })]) {
    const store = new MemoryStorage({ [core.JOURNAL_KEY]: value });
    assert.throws(() => core.readJournal(store)); assert.equal(store.getItem(core.JOURNAL_KEY), value);
    assert.deepEqual(store.operations, []);
  }
});
