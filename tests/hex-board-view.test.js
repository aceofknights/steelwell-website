const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('Hex presentation fits widths without rebuilding the game, and ignores height-only resize feedback', () => {
  let resize;
  let writes = 0;
  const frame = {
    clientWidth: 730,
    style: { setProperty(name, value) { this[name] = value; writes++; } },
    classList: { add() {} }
  };
  const context = {
    requestAnimationFrame(callback) { callback(); },
    document: { querySelector(selector) { assert.equal(selector, '.hex-board-frame'); return frame; } },
    window: { ResizeObserver: true },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe(element) { assert.equal(element, frame); } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../javascript/hex_board_view.js'), 'utf8'), context);
  for (const width of [243, 313, 683, 730, 1100]) {
    frame.clientWidth = width;
    resize();
    const scale = Number(frame.style['--hex-scale']);
    assert.equal(scale, Math.min(1, width / 730));
    assert.ok(730 * scale <= width + 0.001);
    assert.equal(parseFloat(frame.style.height), 650 * scale);
    const before = writes;
    resize();
    assert.equal(writes, before, 'height feedback must not write again');
  }
  frame.clientWidth = 0;
  const before = writes;
  resize();
  assert.equal(writes, before, 'temporarily hidden boards retain their previous fit');
});
