const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../javascript/seating_backup_core.js');
const fixtures = require('./fixtures/seating-storage.json');

test('backup verification is pure and validates both envelope and entry integrity', () => {
  const backup = core.envelope(Object.entries(fixtures.classrooms).map(([key, value]) => ({ key, value })), 'https://fixture.example');
  const original = JSON.stringify(backup);
  const result = core.verifyBackup(original);
  assert.equal(result.entryCount, 9);
  assert.equal(result.structurallyRestorable, true);
  assert.equal(result.applicationReadable, true);
  assert.equal(JSON.stringify(result.backup), original);
  assert.throws(() => core.verifyBackup({ ...backup, version: 99 }));
  assert.throws(() => core.verifyBackup({ ...backup, entries: [{ key: 'unrelated', value: 'x' }] }));
});

test('malformed inner values can be restored raw but are reported as unreadable classroom data', () => {
  const backup = core.envelope(Object.entries(fixtures.malformed).map(([key, value]) => ({ key, value })), 'null');
  const result = core.verifyBackup(backup);
  assert.equal(result.structurallyRestorable, true);
  assert.equal(result.applicationReadable, false);
  assert.deepEqual(result.backup.entries, backup.entries);
});

test('invalid saved layout shapes are preserved raw and prevented from silently applying empty classrooms', () => {
  for (const value of ['{"Broken":null}', '{"Broken":{"tables":{}}}', '{"Broken":{"grid":null}}']) {
    const backup = core.envelope([{ key: 'tableLayouts', value }], 'null');
    const result = core.verifyBackup(backup);
    assert.equal(result.applicationReadable, false);
    assert.equal(result.backup.entries[0].value, value);
  }
});
