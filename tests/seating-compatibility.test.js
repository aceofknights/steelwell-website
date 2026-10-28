const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'javascript/Seating_Chart.js'), 'utf8').replace(/\r\n/g, '\n');
const baseline = require('./fixtures/seating-algorithms-a9ef211.json');

test('all three placement algorithms exactly retain the audited a9ef211 rules and safety guard', () => {
  assert.equal(baseline.sourceCommit, 'a9ef211f279c2799a6360221ac6b1642b8da9457');
  for (const [name, next] of [['randomizeTableByGroups', 'shuffleArray'], ['randomizeGridSeating', 'randomizeSeating'], ['randomizeSeating', 'resetStudentData']]) {
    const start = current.indexOf('function ' + name + '(');
    const end = current.indexOf('function ' + next + '(', start);
    assert.ok(start >= 0 && end > start, name + ' must exist with its expected boundary');
    assert.equal(current.slice(start, end).trim(), baseline.functions[name], name + ' rules must be preserved');
  }
});

test('HTML captures in the head and does not load the application directly', () => {
  const html = fs.readFileSync(path.join(root, 'webpages/SeatingChart.html'), 'utf8');
  assert.ok(html.indexOf('seating_backup_core.js') < html.indexOf('seating_data_protection.js'));
  assert.ok(html.indexOf('seating_data_protection.js') < html.indexOf('</head>'));
  assert.doesNotMatch(html, /<script[^>]+src="[^\"]*Seating_Chart\.js"/);
  assert.match(html, /<fieldset id="seatingApplication" disabled/);
});
test('new production code never clears storage or sends records over the network', () => {
  for (const filename of ['seating_backup_core.js', 'seating_data_protection.js']) {
    const source = fs.readFileSync(path.join(root, 'javascript', filename), 'utf8');
    assert.doesNotMatch(source, /\.clear\s*\(|fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  }
});
