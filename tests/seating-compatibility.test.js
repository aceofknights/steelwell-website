const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const childProcess = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'javascript/Seating_Chart.js'), 'utf8').replace(/\r\n/g, '\n');
const previous = childProcess.execFileSync('git', ['show', 'HEAD:javascript/Seating_Chart.js'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
test('all three placement algorithms retain their existing rules apart from the dangling-table guard', () => {
  function body(source, name, next) {
    return source.slice(source.indexOf('function ' + name + '('), source.indexOf('function ' + next + '(')).trim();
  }
  for (const [name, next] of [['randomizeTableByGroups', 'shuffleArray'], ['randomizeGridSeating', 'randomizeSeating'], ['randomizeSeating', 'resetStudentData']]) {
    const actual = body(current, name, next).replace('        if (!seatsMap[tableId]) continue; // A legacy constraint may reference a deleted table.\n', '');
    assert.equal(actual, body(previous, name, next), name + ' rules must be preserved');
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
