const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/<section id="([^"]+)" class="screen-view/g)].map(m => m[1]);
const targets = [...html.matchAll(/data-screen="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, 12);
for (const id of targets) assert(ids.includes(id), `Missing screen: ${id}`);
assert(!/on(?:click|change)=/.test(html));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/ScreenRouter.js'), 'utf8') + '\nthis.Router = ScreenRouter;', context);
const screens = ids.map(id => ({id, active: false, setActive(value) {this.active = value;}}));
let rendered;
const router = new context.Router(screens, {render(id) {rendered = id;}});
for (const id of ids) {
  assert.equal(router.navigate(id), true);
  assert.deepEqual(screens.filter(s => s.active).map(s => s.id), [id]);
  assert.equal(rendered, id);
}
const previous = router.currentScreenId;
assert.equal(router.navigate('missing'), false);
assert.equal(router.currentScreenId, previous);
assert.deepEqual(screens.filter(s => s.active).map(s => s.id), [previous]);
console.log(`PASS: ${ids.length} routes, ${targets.length} valid links, exclusive active screen, invalid route preserves state.`);
