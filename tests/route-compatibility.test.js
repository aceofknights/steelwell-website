const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../javascript/legacy_redirect.js'), 'utf8');
function run(destination, pathname = '/webpages/about.html') {
  const calls = [];
  const link = {};
  vm.runInNewContext(source, {
    document: { body: { dataset: { cleanRoute: destination } }, getElementById() { return link; } },
    location: { pathname, search: '?value=a%20b&keep=1', hash: '#section-two', replace(value) { calls.push(value); } }
  });
  return { calls, link };
}
test('legacy redirect preserves query and fragment exactly and updates its visible fallback', () => {
  const { calls, link } = run('/about/');
  assert.deepEqual(calls, ['/about/?value=a%20b&keep=1#section-two']);
  assert.equal(link.href, calls[0]);
});
test('canonical route never redirects to itself', () => {
  assert.deepEqual(run('/about/', '/about/').calls, []);
});
test('redirect refuses external, traversal and malformed destinations', () => {
  for (const destination of ['//external.example/', 'https://external.example/', '/a/../b/', '/about/?q=1', '', undefined]) {
    assert.deepEqual(run(destination).calls, []);
  }
});
test('root remains a supported safe destination', () => {
  assert.deepEqual(run('/').calls, ['/?value=a%20b&keep=1#section-two']);
});
test('clean and functional legacy application documents remain identical', () => {
  for (const [legacy, clean] of [['webpages/SeatingChart.html', 'seating-chart/index.html'], ['webpages/HexMath.html', 'hex-math/index.html'], ['webpages/sortTheNumber.html', 'sort-the-numbers/index.html'], ['webpages/survey.html', 'feedback/index.html'], ['webpages/PrivatePolicy.html', 'privacy/hotdog-counter/index.html']]) {
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(read(legacy), read(clean), legacy + ' must not drift from its clean route');
  }
});
test('every declared clean route is a real directory index and cannot redirect onward', () => {
  const routes = require('../data/routes.json').routes;
  const destinations = new Map();
  for (const route of routes) {
    assert.match(route.clean, /^\/(?:[a-z0-9-]+\/)*$/);
    const markup = fs.readFileSync(path.join(__dirname, '..', route.file), 'utf8');
    assert.ok(!markup.includes('data-clean-route='), 'Clean destination must not be another redirect');
    assert.ok(markup.includes('https://chriswellsdev.com' + route.clean));
    if (destinations.has(route.clean)) {
      assert.ok(route.kind === 'retired-authoring-template' || destinations.get(route.clean) === 'retired-authoring-template', 'Only the documented authoring-template retirement may share a route');
    }
    destinations.set(route.clean, route.kind);
  }
});
