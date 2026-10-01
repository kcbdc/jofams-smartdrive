const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = readFileSync(path.join(root, 'app.js'), 'utf8');
const activity = readFileSync(path.join(root, 'android-app/app/src/main/java/com/komsco/jofams/smartdrive/MainActivity.kt'), 'utf8');
function nativeContext() {
  const context = vm.createContext({ state: {}, window: { __JOFAMS_NATIVE_DRIVE_ACTIVE__: true },
    updateGpsEstimateUi() {}, ensureUserMarker() {}, Date, Number, Boolean });
  vm.runInContext(app.slice(app.indexOf('function applyGps('), app.indexOf('function pointAtRouteDistance(')), context);
  return context;
}
function packet(timestamp, estimated = false) {
  return { native: true, timestamp, estimated, rawLatitude: 37.1, rawLongitude: 127.1,
    routeIndex: 2, routeDistance: 120, coords: { latitude: 37, longitude: 127, speed: 10, heading: null, accuracy: 5 } };
}
test('native estimate retains raw coordinates and never refreshes real GPS time', () => {
  const c = nativeContext();
  c.applyGps(packet(1000));
  const realAt = c.state.lastRealGpsAt;
  c.applyGps(packet(1200, true));
  assert.equal(c.state.user.estimated, true);
  assert.equal(c.state.user.rawLat, 37.1);
  assert.equal(c.state.user.routeDistance, 120);
  assert.equal(c.state.user.heading, null);
  assert.equal(c.state.lastRealGpsAt, realAt);
});
test('dual native callbacks and reversed callbacks do not apply twice', () => {
  const c = nativeContext(); let renders = 0;
  c.ensureUserMarker = () => renders++;
  c.applyGps(packet(1000)); c.applyGps(packet(1000)); c.applyGps(packet(900));
  assert.equal(renders, 1);
});
test('missing native route match stays missing rather than becoming route origin', () => {
  const c = nativeContext(); const p = packet(1000);
  p.routeDistance = null; p.routeIndex = null;
  c.applyGps(p);
  assert.equal(c.state.user.routeDistance, null);
  assert.equal(c.state.user.mapSnapped, false);
});
test('web prediction does not compete with native engine', () => {
  const c = vm.createContext({ state: {}, nativeBridgeAvailable: () => true });
  const start = app.indexOf('function deadReckoningTick(){');
  const end = app.indexOf('\nfunction ', start + 10);
  vm.runInContext(app.slice(start, end), c);
  assert.doesNotThrow(() => c.deadReckoningTick());
});
test('Android sync reads module API, detects middle geometry changes, and sends stop with no route', () => {
  const state = { tripStartedAt: 100, route: { geometry: [[127,37],[127.1,37],[127.2,37]] } };
  const payloads = [], active = [];
  const c = vm.createContext({ window: {
    JofamsWebNavigation: { getState: () => state },
    JofamsNavigationBridge: { updateNavigationState: p => payloads.push(JSON.parse(p)), setNavigationActive: a => active.push(a) }
  }, setInterval: fn => { c.tick = fn; }, JSON, Number, Boolean, Array });
  const start = activity.indexOf("let lastNativePayload = '';");
  const end = activity.indexOf('}, 700);', start) + '}, 700);'.length;
  vm.runInContext(activity.slice(start, end), c);
  c.tick(); c.tick();
  assert.equal(payloads.length, 1);
  state.route.geometry[1] = [127.15,37]; c.tick();
  assert.equal(payloads.length, 2);
  state.tripStartedAt = 0; state.route = null; c.tick();
  assert.deepEqual(active, [true, false]);
});
