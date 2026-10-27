// Small DOM stand-ins exercise startup ordering and UI gates, without a real browser or records.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../javascript/seating_backup_core.js');
const source = fs.readFileSync(require.resolve('../javascript/seating_data_protection.js'), 'utf8');
const fixtures = require('./fixtures/seating-storage.json');
function harness(values, options = {}) {
  const data = new Map(Object.entries(values)); const writes = []; const lifecycle = [];
  const storage = { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { writes.push(key); data.set(key, value); }, removeItem: key => data.delete(key) };
  const elements = new Map(); const listeners = {}; let capturedDownload;
  function element(id = '') {
    return { id, hidden: true, disabled: false, open: false, checked: false, files: [], children: [], listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      focus() {}, click() {}, remove() {}, append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; }, showModal() { this.open = true; }, close() { this.open = false; } };
  }
  const document = { addEventListener: (type, fn) => { listeners[type] = fn; },
    getElementById: id => { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
    createElement: tag => { const el = element(); el.tagName = tag; return el; },
    body: { appendChild(el) {
      if (el.tagName === 'script') { lifecycle.push('script'); el.onload(); }
      return el;
    } } };
  const window = { SeatingBackup: core, location: { origin: 'https://fixture.example', reload() {} },
    initializeSeatingChart() { lifecycle.push('initialize'); storage.setItem('tableLayouts', '{"changedByStartup":true}'); } };
  Object.defineProperty(window, 'localStorage', { get() { if (options.unavailable) throw new Error('Blocked storage'); return storage; } });
  const context = { window, document, Blob: class { constructor(parts) { capturedDownload = parts.join(''); } },
    URL: { createObjectURL: () => { if (options.downloadFailure) throw new Error('Download blocked'); return 'blob:fixture'; }, revokeObjectURL() {} }, setTimeout() {}, console };
  vm.runInNewContext(source, context);
  assert.equal(lifecycle.length, 0, 'application must not load before opening capture');
  assert.equal(writes.length, 0, 'opening capture must not write');
  listeners.DOMContentLoaded();
  return { data, writes, lifecycle, elements, listeners, storage, download: () => capturedDownload };
}
test('capture happens before application load, and primary backup retains original raw values', () => {
  const app = harness(fixtures.classrooms);
  assert.deepEqual(app.lifecycle, ['script', 'initialize']);
  app.elements.get('backupClassroomData').listeners.click();
  const exported = core.validateBackup(app.download());
  assert.equal(exported.entries.find(e => e.key === 'tableLayouts').value, fixtures.classrooms.tableLayouts);
  assert.equal(app.elements.get('seatingApplication').disabled, false);
});
test('current backup includes edits since initialization without changing data', () => {
  const app = harness(fixtures.classrooms); const count = app.writes.length;
  app.elements.get('backupCurrentClassroomData').listeners.click();
  assert.equal(core.validateBackup(app.download()).entries.find(e => e.key === 'tableLayouts').value, '{"changedByStartup":true}');
  assert.equal(app.writes.length, count);
});
test('malformed records remain exportable while application startup is paused', () => {
  const app = harness(fixtures.malformed);
  assert.deepEqual(app.lifecycle, []); assert.deepEqual(app.writes, []);
  assert.equal(app.elements.get('seatingApplication').disabled, true);
  app.elements.get('backupClassroomData').listeners.click();
  assert.equal(core.validateBackup(app.download()).entries.find(e => e.key === 'seatingChartData_Broken').value, fixtures.malformed.seatingChartData_Broken);
});
test('blocked storage pauses startup and gives an understandable error', () => {
  const app = harness({}, { unavailable: true });
  assert.deepEqual(app.lifecycle, []); assert.deepEqual(app.writes, []);
  assert.equal(app.elements.get('backupClassroomData').disabled, true);
  assert.match(app.elements.get('dataProtectionError').textContent, /paused/);
});
test('pending recovery is never applied automatically and blocks normal startup', () => {
  const journal = { format: 'chriswellsdev-seating-recovery', version: 1,
    before: [{ key: 'classList', value: '["default"]' }], writes: [{ key: 'classList', value: '["changed"]' }] };
  const app = harness({ classList: '["changed"]', [core.JOURNAL_KEY]: JSON.stringify(journal) });
  assert.deepEqual(app.lifecycle, []); assert.deepEqual(app.writes, []);
  assert.equal(app.elements.get('recoverClassroomData').hidden, false);
  assert.equal(app.elements.get('restoreClassroomData').disabled, true);
});
test('restore preview/cancellation leave data intact and require explicit confirmation', async () => {
  const app = harness(fixtures.classrooms); const before = [...app.data];
  const incoming = core.envelope([{ key: 'classList', value: '["replacement"]' }], 'https://fixture.example');
  const input = app.elements.get('classroomBackupFile'); input.files = [{ text: async () => JSON.stringify(incoming) }];
  await input.listeners.change();
  assert.equal(app.elements.get('dataRestoreDialog').open, true);
  assert.equal(app.elements.get('confirmDataRestore').disabled, true);
  app.elements.get('confirmDataRestore').listeners.click();
  assert.deepEqual([...app.data], before);
  app.elements.get('cancelDataRestore').listeners.click();
  assert.equal(app.elements.get('dataRestoreDialog').open, false);
  assert.deepEqual([...app.data], before);
});
test('confirmed restore is not followed by automatic application startup/reload', async () => {
  const app = harness(fixtures.classrooms);
  const input = app.elements.get('classroomBackupFile');
  input.files = [{ text: async () => JSON.stringify(core.envelope([{ key: 'classList', value: '["restored"]' }], 'https://fixture.example')) }];
  await input.listeners.change();
  app.elements.get('dataRestoreConfirm').checked = true;
  app.elements.get('dataRestoreConfirm').listeners.change();
  app.elements.get('confirmDataRestore').listeners.click();
  assert.equal(app.data.get('classList'), '["restored"]');
  assert.deepEqual(app.lifecycle, ['script', 'initialize']);
  assert.equal(app.elements.get('seatingApplication').disabled, true);
  assert.equal(app.elements.get('openRestoredClassroom').hidden, false);
});
test('invalid imports do not open a restore confirmation or change data', async () => {
  const app = harness(fixtures.classrooms); const before = [...app.data];
  app.elements.get('classroomBackupFile').files = [{ text: async () => 'not JSON' }];
  await app.elements.get('classroomBackupFile').listeners.change();
  assert.equal(app.elements.get('dataRestoreDialog').open, false);
  assert.deepEqual([...app.data], before);
});

test('verification reads a backup without previewing a restore or changing any saved items', async () => {
  const app = harness(fixtures.classrooms); const before = [...app.data];
  app.elements.get('verifyClassroomBackup').listeners.click();
  app.elements.get('classroomBackupFile').files = [{ text: async () => JSON.stringify(core.envelope(
    [{ key: 'seatingChartData_Broken', value: '{broken' }], 'https://fixture.example')) }];
  await app.elements.get('classroomBackupFile').listeners.change();
  assert.deepEqual([...app.data], before);
  assert.equal(app.elements.get('dataRestoreDialog').open, false);
  assert.match(app.elements.get('dataProtectionStatus').textContent, /Backup verified.*malformed/);
});

test('detectable download failure reports an error and makes no storage changes', () => {
  const app = harness(fixtures.classrooms, { downloadFailure: true }); const before = [...app.data];
  app.elements.get('backupClassroomData').listeners.click();
  assert.match(app.elements.get('dataProtectionError').textContent, /could not be downloaded/);
  assert.deepEqual([...app.data], before);
});

test('invalid nested classroom structures pause before initialization without replacing raw records', () => {
  for (const invalid of [{ tables: {} }, { studentsData: null }, { studentsData: { Synthetic: null } }, { manualStudentNames: null }]) {
    const raw = JSON.stringify(invalid); const app = harness({ seatingChartData_default: raw });
    assert.deepEqual(app.lifecycle, []);
    assert.equal(app.data.get('seatingChartData_default'), raw);
    assert.deepEqual(app.writes, []);
  }
});
