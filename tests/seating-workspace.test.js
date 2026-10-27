const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
test('workspace preserves backup/recovery files and the audited color-compatible core revision', () => {
  const hashes = {
    'Seating_Chart.js': 'd5b27bc871140eb1350d5007ae9d88ba4a0a60f81e2b210246e27b84cbc27ff1',
    'seating_backup_core.js': '2996ee7f0974fb91b69bcaaab84a173f9c29c9da9a11a5b501439e618fa0be5b',
    'seating_data_protection.js': '760d1922509340e5f83f7f51dbcd89dd6c5e3053bbc5252ce897a5d2d74f2eb3'
  };
  for (const [name, expected] of Object.entries(hashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'javascript', name))).digest('hex'), expected, name);
  }
});
test('workspace adapter has no persistence, networking or model/placement calls', () => {
  const source = fs.readFileSync(path.join(root, 'javascript/seating_workspace.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|saveTables\s*\(|randomizeSeating\s*\(|loadClassData\s*\(/);
});
test('workspace retains unique original control IDs and scoped styles', () => {
  const html = fs.readFileSync(path.join(root, 'webpages/SeatingChart.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of ['classroom','seatingApplication','studentList','studentListContainer','addTableBtn','classSelector','layoutSelector','layoutModeSelect','bulk-add-textarea','backupClassroomData','restoreClassroomData','verifyClassroomBackup','classroomBackupFile','dataRestoreDialog','recoverClassroomData']) assert.ok(ids.includes(id), id);
  assert.match(html, /class="portfolio seating-workspace"/);
  assert.match(html, /id="workspaceViewport"[^>]*tabindex="0"/);
});

test('touch editing uses the existing save boundary without direct storage or placement access', () => {
  const source = fs.readFileSync(path.join(root, 'javascript/seating_touch.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|\.setItem\s*\(|fetch\s*\(|randomizeSeating\s*\(|loadClassData\s*\(/);
  assert.match(source, /window\.saveTables\(\)/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /pointercancel/);
  assert.match(source, /lostpointercapture/);
});
