const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../data/sky-catalog.json');
const source = fs.readFileSync(path.join(__dirname, '../src/sky-renderer.js'), 'utf8');
const rendererModule = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}

function createEnvironment(reduced = false, width = 390, height = 844) {
  const document = { ...eventTarget(), hidden: false };
  const frames = new Map();
  let frameId = 0;
  const media = { ...eventTarget(), matches: reduced };
  const coarse = { matches: width < 768 };
  const paints = [];
  let arcs = [];
  const gradient = { addColorStop() {} };
  const context = {
    createRadialGradient: () => gradient,
    fillRect() { if (arcs.length) paints.push(arcs); arcs = []; },
    setTransform(...values) { context.transform = values; },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {}, fill() {},
    arc(x, y, radius) { assert([x, y, radius].every(Number.isFinite)); arcs.push([x, y, radius]); },
  };
  const canvas = {
    ownerDocument: document,
    getContext: () => context,
    getBoundingClientRect: () => ({ width, height }),
  };
  document.createElement = () => ({ getContext: () => ({ ...context, fillRect() {} }) });
  let observer;
  const window = {
    ...eventTarget(), devicePixelRatio: 3, innerWidth: width, innerHeight: height,
    matchMedia: query => query.includes('reduced-motion') ? media : coarse,
    requestAnimationFrame: fn => { const id = ++frameId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(fn) { this.callback = fn; observer = this; }
      observe(element) { this.element = element; }
      disconnect() { this.disconnected = true; }
    },
  };
  document.defaultView = window;
  return {
    canvas, context, document, window, frames, media, paints,
    get observer() { return observer; },
    get arcs() { return arcs; },
    size(newWidth, newHeight) { width = newWidth; height = newHeight; },
    advance(now) {
      assert.equal(frames.size, 1);
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      fn(now);
    },
  };
}

test('React sky retains authentic catalogue geometry while improving visibility and automatic motion', async () => {
  const { equatorialVector, rotateVector, projectVector, magnitudeAppearance, skyOrientation, sphericalLine } = await rendererModule;
  assert.equal(catalog.stars.length, 3596);
  assert.equal(catalog.epoch, 'J2000');
  assert.deepEqual(catalog.stars.find(star => star[0] === 32349), [32349, 101.2872, -16.7161, -1.44]);
  const vectors = catalog.stars.slice(0, 3).map(star => equatorialVector(star[1], star[2]));
  const moved = vectors.map(vector => rotateVector(vector, 1.4, -0.35));
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  for (let i = 0; i < vectors.length; i++) {
    assert(Math.abs(Math.hypot(...moved[i]) - 1) < 1e-12);
    assert(Math.abs(dot(vectors[0], vectors[i]) - dot(moved[0], moved[i])) < 1e-12);
  }
  assert.deepEqual(projectVector([0, 0, 1], 390, 844), [195, 422, 1]);
  assert.equal(projectVector([0, 0, -1], 390, 844), null);
  const bright = magnitudeAppearance(-1.44), faint = magnitudeAppearance(5.7);
  assert(bright.radius > faint.radius && bright.opacity > faint.opacity);
  assert(faint.radius > 0.85 && faint.opacity > 0.43);
  assert(Math.abs(skyOrientation(1000).yaw - skyOrientation(0).yaw - 0.02) < 1e-12);
  const arc = sphericalLine([[0, 0], [90, 25]]);
  assert(arc.length > 20);
  for (const vector of arc) assert(Math.abs(Math.hypot(...vector) - 1) < 1e-12);
  assert.deepEqual(arc[0], equatorialVector(0, 0));
  for (let i = 0; i < 3; i++) assert(Math.abs(arc.at(-1)[i] - equatorialVector(90, 25)[i]) < 1e-12);
});

test('real catalogue animates on a touch-sized canvas without pointer input and caps mobile pixel cost', async () => {
  const { createSkyRenderer } = await rendererModule;
  const r = createEnvironment();
  const catalogBefore = JSON.stringify(catalog);
  const controller = createSkyRenderer(r.canvas, catalog);
  assert.equal(r.canvas.width, 585);
  assert.equal(r.canvas.height, 1266);
  assert.deepEqual(r.context.transform, [1.5, 0, 0, 1.5, 0, 0]);
  assert(r.arcs.length > 1000);
  const firstPaint = r.arcs.map(point => [...point]);
  for (let now = 0; now <= 1000; now += 50) r.advance(now);
  assert.notDeepEqual(r.arcs, firstPaint);
  assert.equal(JSON.stringify(catalog), catalogBefore);
  controller.destroy();
  assert.equal(r.frames.size, 0);
  const desktop = createEnvironment(false, 1440, 900);
  const desktopController = createSkyRenderer(desktop.canvas, catalog);
  assert.equal(desktop.canvas.width, 2520);
  desktopController.destroy();
});

test('React effect cleanup removes animation, resize observer and every event listener', async () => {
  const { createSkyRenderer } = await rendererModule;
  const r = createEnvironment();
  const controller = createSkyRenderer(r.canvas, catalog);
  assert.equal(r.observer.element, r.canvas);
  assert.equal(r.frames.size, 1);
  r.document.hidden = true;
  r.document.emit('visibilitychange');
  assert.equal(r.frames.size, 0);
  r.document.hidden = false;
  r.document.emit('visibilitychange');
  assert.equal(r.frames.size, 1);
  r.window.emit('pageshow');
  assert.equal(r.frames.size, 1);
  r.media.matches = true;
  r.media.emit('change');
  assert.equal(r.frames.size, 0);
  r.size(600, 750);
  r.observer.callback();
  assert.equal(r.canvas.width, 900);
  assert.equal(r.canvas.height, 1125);
  r.media.matches = false;
  r.media.emit('change');
  assert.equal(r.frames.size, 1);
  r.window.emit('pagehide');
  assert.equal(r.frames.size, 0);
  r.window.emit('pageshow');
  assert.equal(r.frames.size, 1);
  controller.destroy();
  controller.destroy();
  assert.equal(r.frames.size, 0);
  assert.equal(r.observer.disconnected, true);
  assert.equal(r.window.listenerCount(), 0);
  assert.equal(r.document.listenerCount(), 0);
  assert.equal(r.media.listenerCount(), 0);
  r.window.emit('pageshow');
  r.observer.callback();
  assert.equal(r.frames.size, 0);

  const staticEnvironment = createEnvironment(true);
  const staticController = createSkyRenderer(staticEnvironment.canvas, catalog);
  assert(staticEnvironment.arcs.length > 1000);
  assert.equal(staticEnvironment.frames.size, 0);
  staticController.destroy();
});
