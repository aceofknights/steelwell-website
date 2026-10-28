/* Real DOM integration tests. Never use production storage or real classroom records. */
(function () {
  'use strict';
  const button = document.getElementById('run');
  const output = document.getElementById('results');
  if (location.origin !== 'http://127.0.0.1:8873') {
    button.disabled = true;
    output.textContent = 'Disabled: dedicated loopback test origin required.';
    return;
  }
  const core = window.SeatingBackup;
  const frame = document.getElementById('app');
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message);
  const pause = () => new Promise(resolve => setTimeout(resolve, 20));
  let fixtures, win, doc, alerts, errors;
  const saved = name => JSON.parse(localStorage.getItem('seatingChartData_' + name));
  const names = () => [...doc.querySelectorAll('#classroom .seat')].map(seat => seat.dataset.studentName || '');
  function event(element, type) { element.dispatchEvent(new win.Event(type, { bubbles: true })); }
  function change(selector, value, type = 'change') { const el = doc.querySelector(selector); el.value = value; event(el, type); }
  async function open(values, expectReady = true) {
    frame.src = 'about:blank';
    await new Promise(resolve => { frame.onload = resolve; });
    core.readEntries(localStorage).forEach(entry => localStorage.removeItem(entry.key));
    localStorage.removeItem(core.JOURNAL_KEY);
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
    localStorage.setItem('reliability-unrelated', 'unchanged');
    alerts = []; errors = [];
    await window.loadSyntheticSeatingPage(frame);
    win = frame.contentWindow; doc = frame.contentDocument;
    win.alert = text => alerts.push(text); win.confirm = () => true;
    win.addEventListener('error', e => { if (!e.error?.classroomStorageError) errors.push(e.message); });
    for (let i = 0; i < 150; i++) {
      if (doc.querySelector('#randomizeSeatingBtn') || !doc.querySelector('#dataProtectionError').hidden) break;
      await pause();
    }
    if (expectReady) assert(!doc.querySelector('#seatingApplication').disabled, 'Application must open: ' + doc.querySelector('#dataProtectionError').textContent);
  }
  async function run(name, fn) {
    try { await fn(); output.textContent += '\nPASS ' + name; }
    catch (error) { output.textContent += '\nFAIL ' + name + ': ' + error.message; }
  }
  function normal() {
    const values = { ...fixtures.classrooms };
    const data = JSON.parse(values.seatingChartData_default);
    data.tables[0].seats = ['Avery', 'Blake', 'Drew', ''];
    data.tables[0].posY = 0;
    values.seatingChartData_default = JSON.stringify(data);
    return values;
  }
  function randomFixture(mode) {
    const people = ['Alex Test', 'Bea "Quote"', 'Chloé 王', 'Dara [x]', 'Absent Fixture'];
    const tables = ['left', 'right'].map(id => ({ id, seatCount: 2, columnCount: 2, posX: id === 'left' ? 0 : 400, posY: 0, seats: ['', ''] }));
    const studentsData = Object.fromEntries(people.map((name, i) => [name, { present: i !== 4, blacklist: [], groupId: i % 2 ? 'b' : 'a' }]));
    studentsData[people[0]].lockedSeat = mode === 'grid' ? { mode: 'grid', row: 1, column: 1 } : { tableId: 'left', seatIndex: 0 };
    if (mode !== 'grid') studentsData[people[1]].lockedTable = 'right';
    studentsData[people[0]].blacklist = [people[1]];
    const data = { tables, manualStudentNames: people, studentsData, layoutMode: mode === 'grid' ? 'grid' : 'table',
      gridSettings: { rows: 2, columns: 3, aisles: ['1-2'], rowGap: 8, columnGap: 8 }, gridSeats: [],
      studentGroups: mode === 'groups' ? [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] : [], useGroupAlternating: mode === 'groups' };
    return { classList: '["default"]', seatingChartData_default: JSON.stringify(data) };
  }
  button.addEventListener('click', async () => {
    button.disabled = true; output.textContent = 'Running synthetic tests…';
    try {
      fixtures = await (await fetch('/tests/fixtures/seating-storage.json')).json();
      await run('locked/unlocked assignments and visible names survive load, autosave, switching and reload', async () => {
        const values = normal(); await open(values);
        equal(names(), ['Avery', 'Blake', 'Drew', ''], 'Loaded assignments');
        assert(doc.querySelector('.seat').textContent.includes('Avery'), 'Locked name visible');
        change('.table-name-input', 'Updated', 'input');
        equal(saved('default').tables[0].seats, names(), 'Autosave preserves assignments');
        change('#classSelector', 'Science');
        assert(names().includes('Ellis') && names().includes('Finley'), 'Grid locked/unlocked load');
        change('#classSelector', 'default');
        equal(names(), ['Avery', 'Blake', 'Drew', ''], 'Class switch preserves assignments');
        const entries = Object.fromEntries(core.readEntries(localStorage).map(e => [e.key, e.value]));
        await open(entries);
        equal(names(), ['Avery', 'Blake', 'Drew', ''], 'Reload preserves assignments');
      });
      await run('table color/columns preserve live assignments, IDs and zero geometry', async () => {
        await open(normal());
        win.setSeatStudent(doc.querySelectorAll('.seat')[2], 'Edited Synthetic');
        change('.seat-color', 'blue'); change('.column-count', '3', 'input');
        equal(names(), ['Avery', 'Blake', 'Edited Synthetic', ''], 'Redraw uses live seats');
        const table = saved('default').tables[0];
        equal([table.id, table.posX, table.posY, table.width, table.height], ['fixture-table', 0, 0, 360, 400], 'Geometry retained');
        assert(table.futureTableField === 17 && saved('default').unknownClassField.nested[0] === 'preserve', 'Unknown table and class fields retained');
        equal(win.getCurrentTableLayout().map(t => [t.posX, t.posY]), [[0, 0]], 'Layout zero coordinates');
      });
      await run('legacy locks without complete seat snapshots fill empty seats without clearing unlocked students', async () => {
        const values = normal(); const data = JSON.parse(values.seatingChartData_default);
        data.tables[0].seats = ['Avery', '', 'Drew', '']; values.seatingChartData_default = JSON.stringify(data);
        const science = JSON.parse(values.seatingChartData_Science);
        science.gridSeats = science.gridSeats.filter(seat => seat.studentName !== 'Ellis');
        values.seatingChartData_Science = JSON.stringify(science); await open(values);
        equal(names(), ['Avery', 'Blake', 'Drew', ''], 'Table-only lock restored without clearing unlocked student');
        change('#classSelector', 'Science'); assert(names().includes('Ellis') && names().includes('Finley'), 'Grid lock and unlocked student retained');
      });
      await run('seat reduction unassigns removed seats, retains roster, releases invalid exact locks and never resurrects names', async () => {
        const values = normal(); const data = JSON.parse(values.seatingChartData_default);
        data.studentsData.Drew.lockedSeat = { tableId: 'fixture-table', seatIndex: 2 };
        values.seatingChartData_default = JSON.stringify(data); await open(values);
        change('.seat-count', '2'); change('.seat-count', '4');
        equal(names(), ['Avery', 'Blake', '', ''], 'Removed assignment stays unassigned');
        assert(saved('default').manualStudentNames.includes('Drew'), 'Student retained');
        assert(saved('default').studentsData.Drew.lockedSeat === null, 'Invalid exact lock released');
      });
      await run('special-character student names and table IDs work in constraint controls', async () => {
        const values = randomFixture('normal'); const data = JSON.parse(values.seatingChartData_default);
        data.tables[0].id = 'table "quoted" [王]';
        data.studentsData['Alex Test'].lockedSeat.tableId = data.tables[0].id;
        values.seatingChartData_default = JSON.stringify(data); await open(values);
        for (const item of [...doc.querySelectorAll('.student-list-item')]) {
          item.querySelector('.options-btn').click();
          const none = item.querySelector('input[value="none"]'); none.checked = true; event(none, 'change');
          item.querySelector('.save-options-btn').click();
        }
        equal(errors, [], 'No selector errors');
      });
      for (const mode of ['normal', 'groups', 'grid']) await run(mode + ' randomization preserves locks, attendance, uniqueness and blacklist semantics', async () => {
        await open(randomFixture(mode));
        for (let i = 0; i < 12; i++) {
          doc.querySelector('#randomizeSeatingBtn').click();
          const occupied = names().filter(Boolean);
          equal([...occupied].sort(), ['Alex Test', 'Bea "Quote"', 'Chloé 王', 'Dara [x]'].sort(), 'All present students placed exactly once');
          if (mode === 'grid') {
            assert(doc.querySelector('[data-row="1"][data-column="1"]').dataset.studentName === 'Alex Test', 'Exact grid lock');
            assert(!doc.querySelector('[data-row="1"][data-column="2"]').dataset.studentName, 'Aisle remains empty');
            assert(doc.querySelector('[data-row="2"][data-column="1"]').dataset.studentName !== 'Bea "Quote"', 'Grid neighbor blacklist');
          } else {
            assert(doc.querySelector('[data-id="left"] .seat').dataset.studentName === 'Alex Test', 'Exact table seat lock');
            assert([...doc.querySelectorAll('[data-id="right"] .seat')].some(s => s.dataset.studentName === 'Bea "Quote"'), 'Table lock and mutual blacklist');
          }
        }
        equal(errors, [], 'No application errors');
      });
      await run('deleting a table clears exact/table locks and randomization remains safe', async () => {
        await open(normal()); doc.querySelector('.delete-btn').click();
        const data = saved('default');
        assert(data.studentsData.Avery.lockedSeat === null && data.studentsData.Blake.lockedTable === null, 'Both locks released');
        doc.querySelector('#addTableBtn').click(); doc.querySelector('#randomizeSeatingBtn').click();
        equal(errors, [], 'No dangling table crash');
      });
      await run('legacy dangling table constraints never crash any randomizer', async () => {
        for (const mode of ['normal', 'groups', 'grid']) {
          const values = randomFixture(mode); const data = JSON.parse(values.seatingChartData_default);
          data.studentsData['Bea "Quote"'].lockedTable = 'deleted-legacy-table';
          if (mode !== 'grid') data.studentsData['Alex Test'].lockedSeat.tableId = 'deleted-exact-table';
          values.seatingChartData_default = JSON.stringify(data); await open(values);
          doc.querySelector('#randomizeSeatingBtn').click(); equal(errors, [], 'No dangling constraint crash: ' + mode);
        }
      });
      await run('R ignores typing, contenteditable, modifiers, composition and repeat; plain R and button still work', async () => {
        await open(normal()); let calls = 0; const original = win.randomizeSeating;
        win.randomizeSeating = () => calls++;
        for (const target of [doc.querySelector('textarea'), doc.querySelector('input'), doc.querySelector('select')]) {
          target.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        }
        const editable = doc.createElement('div'); editable.contentEditable = 'true'; doc.body.append(editable);
        editable.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        for (const option of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'repeat', 'isComposing']) {
          doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'r', bubbles: true, [option]: true }));
        }
        assert(calls === 0, 'Typing/modifiers must not randomize');
        doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        assert(calls === 1, 'Plain R randomizes once'); win.randomizeSeating = original;
        doc.querySelector('#randomizeSeatingBtn').click(); assert(names().filter(Boolean).length === 3, 'Explicit button works');
      });
      await run('legacy migration is idempotent, retains original keys, and supports arrays and name conflicts', async () => {
        const values = normal();
        values.tableLayouts_default = JSON.stringify({ 'Shared Room': { mode: 'table', tables: [] }, 'Array Room': [{ id: 'array-table', seatCount: 2, posX: 0, posY: 0 }] });
        await open(values); const first = localStorage.getItem('tableLayouts');
        win.migrateClassLayoutsToSharedLibrary(); win.migrateClassLayoutsToSharedLibrary(); win.initializeSeatingChart();
        assert(first === localStorage.getItem('tableLayouts'), 'No duplicates on repeated migration');
        assert(values.tableLayouts_default === localStorage.getItem('tableLayouts_default'), 'Legacy raw values retained');
        const arrayLayout = JSON.parse(first)['Array Room'];
        win.applySavedLayout(arrayLayout); assert(doc.querySelector('.table').dataset.id === 'array-table', 'Legacy array remains usable');
        assert(doc.querySelectorAll('#randomizeSeatingBtn').length === 1, 'No duplicate initialization controls');
      });
      await run('malformed JSON and invalid nested data pause startup without replacing raw values', async () => {
        for (const raw of ['{malformed', '{"tables":{}}', '{"studentsData":null}']) {
          await open({ classList: '["default"]', seatingChartData_default: raw }, false);
          assert(doc.querySelector('#seatingApplication').disabled, 'App paused');
          assert(localStorage.getItem('seatingChartData_default') === raw, 'Raw value retained');
        }
      });
      await run('runtime malformed, unavailable and full storage pause editing and preserve saved values', async () => {
        for (const mode of ['malformed', 'unavailable', 'full']) {
          await open(normal()); const before = localStorage.getItem('seatingChartData_default');
          const originalGet = win.Storage.prototype.getItem; const originalSet = win.Storage.prototype.setItem;
          if (mode === 'malformed') localStorage.setItem('seatingChartData_default', '{runtime malformed');
          if (mode === 'unavailable') win.Storage.prototype.getItem = () => { throw new win.DOMException('Blocked', 'SecurityError'); };
          if (mode === 'full') win.Storage.prototype.setItem = () => { throw new win.DOMException('Full', 'QuotaExceededError'); };
          change('.seat-color', 'blue');
          assert(doc.querySelector('#seatingApplication').disabled, 'Storage failure pauses edits: ' + mode);
          assert(!doc.querySelector('#dataProtectionError').hidden, 'Teacher-readable error');
          win.Storage.prototype.getItem = originalGet; win.Storage.prototype.setItem = originalSet;
          assert(localStorage.getItem('seatingChartData_default') === (mode === 'malformed' ? '{runtime malformed' : before), 'Raw data not reset');
        }
      });
      assert(localStorage.getItem('reliability-unrelated') === 'unchanged', 'Unrelated storage must remain untouched');
      output.textContent += '\nCOMPLETE — ' + (output.textContent.includes('FAIL') ? 'failures above' : 'all tests passed') + '. Synthetic data only.';
    } catch (error) { output.textContent += '\nHARNESS ERROR: ' + error.message; }
    finally { button.disabled = false; }
  });
})();
