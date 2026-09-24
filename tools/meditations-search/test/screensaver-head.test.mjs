import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { project, gazeTarget, springStep, drift, strokeVertices, mountHead, MAX_YAW, MAX_PITCH, DRIFT_YAW, DRIFT_PITCH } from '../../../meditations/screensaver/head.js';
import drawing from '../../../meditations/screensaver/head-data.js';
import { headStrokes, formatHeadData, depth } from '../build-screensaver-head.mjs';

// A nose in front of the pivot and an ear on the rotation axis.
const nose = [0, 20, 200], ear = [180, 0, 0];

test('the rest pose reproduces the drawing exactly', () => {
  const vertices = Float32Array.of(...nose, ...ear, -37.5, 12.25, 90);
  assert.deepEqual([...project(vertices, 0, 0)], [0, 20, 180, 0, -37.5, 12.25]);
});

test('turning moves the face more than the silhouette, toward the pointer', () => {
  const vertices = Float32Array.of(...nose, ...ear);
  const right = project(vertices, MAX_YAW, 0);
  const noseShift = right[0] - nose[0], earShift = right[2] - ear[0];
  assert.ok(noseShift > 0, 'a positive yaw moves the nose to the viewer’s right');
  // Holds while the angles stay small enough for the sculpted depth to convince.
  assert.ok(noseShift > 10 * Math.abs(earShift), 'the nose moves far more than the ear on the axis');
  const down = project(vertices, 0, MAX_PITCH);
  assert.ok(down[1] > nose[1], 'a positive pitch makes him look down');
});

test('gaze follows the pointer and eases into its limits', () => {
  assert.deepEqual(gazeTarget(0, 0), { yaw: 0, pitch: 0 });
  assert.ok(gazeTarget(0.5, 0).yaw > 0 && gazeTarget(-0.5, 0).yaw < 0);
  assert.ok(gazeTarget(0, 0.5).pitch > 0, 'pointer below: he looks down');
  assert.ok(gazeTarget(1, 0).yaw > gazeTarget(0.5, 0).yaw);
  for (const d of [-50, -1, 1, 50]) {
    const { yaw, pitch } = gazeTarget(d, d);
    assert.ok(Math.abs(yaw) <= MAX_YAW && Math.abs(pitch) <= MAX_PITCH);
  }
});

test('the spring settles in about two seconds without overshooting', () => {
  let state = { x: 0, v: 0 }, peak = 0;
  for (let frame = 0; frame < 150; frame++) { // 2.5 s at 60 fps
    state = springStep(state, 1, 1 / 60);
    peak = Math.max(peak, state.x);
  }
  assert.ok(peak < 1, 'never overshoots');
  assert.ok(state.x > 0.98, `settled at ${state.x}`);
  let short = { x: 0, v: 0 };
  for (let i = 0; i < 30; i++) short = springStep(short, 1, 0.5 / 30);
  assert.ok(Math.abs(springStep({ x: 0, v: 0 }, 1, 0.5).x - short.x) < 1e-9, 'exact steps: timer ticks and frames agree');
});

test('the drift stays barely visible', () => {
  for (let s = 0; s < 3600; s += 0.7) {
    const { yaw, pitch } = drift(s);
    assert.ok(Math.abs(yaw) <= DRIFT_YAW && Math.abs(pitch) <= DRIFT_PITCH);
  }
  assert.ok(DRIFT_YAW < MAX_YAW / 5, 'a fraction of a glance');
  assert.notEqual(drift(10).yaw, drift(0).yaw);
});

test('strokes decode from half units, the second end relative to the first', () => {
  assert.deepEqual([...strokeVertices([2, -4, 6, -3, 1, 0])], [1, -2, 3, -0.5, -1.5, 3]);
});

test('head data is a plausible set of strokes with depth', () => {
  const { strokes, width, height, pivot } = drawing;
  const count = strokes.length / 6;
  // Count first: an empty drawing would pass every check below.
  assert.ok(Number.isInteger(count) && count > 1500 && count < 6000, `unexpected stroke count ${count}`);
  assert.ok(strokes.every(Number.isInteger), 'whole half units');
  const vertices = strokeVertices(strokes);
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] + pivot[0], y = vertices[i + 1] + pivot[1], z = vertices[i + 2];
    assert.ok(x > -0.2 * width && x < 1.2 * width && y > -0.1 * height && y < 1.1 * height, `vertex ${i / 3} outside the drawing`);
    assert.ok(z > -30 && z < 260, `vertex ${i / 3} has depth ${z}`);
  }
});

test('at rest he faces the viewer: the frontmost point sits on the pivot axis', () => {
  const vertices = strokeVertices(drawing.strokes);
  let front = 0;
  for (let i = 0; i < vertices.length; i += 3) if (vertices[i + 2] > vertices[front + 2]) front = i;
  assert.ok(Math.abs(vertices[front]) < 12, `nose is ${vertices[front]} units off-axis`);
});

test('the sculpted depth puts the nose before the cheeks and the cheeks before the hair', () => {
  assert.ok(depth(157, 287) > depth(100, 290) + 30);
  assert.ok(depth(100, 290) > depth(12, 265) + 80);
});

test('committed head data matches the generator', { skip: process.platform !== 'darwin' && 'needs macOS sips' }, () => {
  const committed = fs.readFileSync(new URL('../../../meditations/screensaver/head-data.js', import.meta.url), 'utf8');
  assert.ok(formatHeadData(headStrokes()) === committed,
    'head-data.js is stale, or a macOS or Node update changed how the photo decodes. '
    + 'Regenerate with node tools/meditations-search/build-screensaver-head.mjs and look at the result.');
});

// A fake browser with a manual clock: animation frames and timers only run when
// run() advances time, so mountHead's scheduling can be counted exactly.
function fakeBrowser({ width = 1440, height = 900, ratio = 2, reduced = false } = {}) {
  let now = 0, id = 0, path = [];
  const frames = new Map(), timers = new Map(), media = {}, events = {}, paths = [], saved = new Map();
  const counts = { frames: 0, timers: 0, draws: 0 };
  const stub = (name, value) => {
    if (!saved.has(name)) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };
  const on = (type, fn) => (events[type] ??= []).push(fn);
  const emit = (type, event) => { for (const fn of events[type] ?? []) fn(event); };
  const query = text => (media[text] ??= { matches: false, fns: [], addEventListener(type, fn) { this.fns.push(fn); } });
  stub('innerWidth', width);
  stub('innerHeight', height);
  stub('devicePixelRatio', ratio);
  stub('performance', { now: () => now });
  stub('requestAnimationFrame', fn => { frames.set(++id, fn); return id; });
  stub('cancelAnimationFrame', key => frames.delete(key));
  stub('setTimeout', (fn, delay, ...args) => { timers.set(++id, { at: now + delay, fn, args }); return id; });
  stub('clearTimeout', key => timers.delete(key));
  stub('matchMedia', query);
  stub('getComputedStyle', () => ({ color: 'black' }));
  stub('addEventListener', on);
  stub('document', { hidden: false, addEventListener: on });
  query('(prefers-reduced-motion: reduce)').matches = reduced;
  const context = {
    clearRect() {}, beginPath() { path = []; }, moveTo(x, y) { path.push(x, y); }, lineTo(x, y) { path.push(x, y); },
    stroke() { counts.draws++; paths.push(path); },
  };
  const canvas = { style: {}, width: 0, height: 0, classList: { add() {} }, getContext: () => context };
  return {
    canvas, counts,
    run(seconds) {
      for (const end = now + seconds * 1000; now < end;) {
        now += 1000 / 60;
        for (const [key, timer] of [...timers]) {
          if (timer.at <= now) { timers.delete(key); counts.timers++; timer.fn(...timer.args); }
        }
        const due = [...frames.values()];
        frames.clear();
        for (const fn of due) { counts.frames++; fn(now); }
      }
    },
    pointer(x, y) { emit('pointermove', { pointerType: 'mouse', clientX: x, clientY: y }); },
    hide(hidden) { globalThis.document.hidden = hidden; emit('visibilitychange'); },
    latest: () => paths.at(-1),
    // Largest move of any stroke end since `from`, in device pixels.
    moved: from => Math.max(...from.map((v, i) => Math.abs(v - paths.at(-1)[i]))),
    restore() { for (const [name, d] of saved) d ? Object.defineProperty(globalThis, name, d) : delete globalThis[name]; },
  };
}

test('only drifting: a slow timer and whole-pixel steps, never animation frames', () => {
  const browser = fakeBrowser();
  try {
    mountHead(browser.canvas, drawing);
    browser.run(1);
    const { frames, draws } = browser.counts;
    browser.run(10);
    assert.equal(browser.counts.frames, frames, 'no animation frames while only drifting');
    const redraws = browser.counts.draws - draws;
    assert.ok(redraws > 5 && redraws <= 50, `${redraws} redraws in 10 s`);
  } finally { browser.restore(); }
});

test('a turn animates until it looks finished, then drops back to the timer', () => {
  const browser = fakeBrowser();
  try {
    mountHead(browser.canvas, drawing);
    browser.run(1);
    const rest = browser.latest(), frames = browser.counts.frames;
    browser.pointer(1440, 450);
    browser.run(8);
    const seconds = (browser.counts.frames - frames) / 60;
    assert.ok(seconds > 1.5 && seconds < 4.5, `animation frames for ${seconds.toFixed(1)} s`);
    assert.ok(browser.moved(rest) > 30, 'he turned');
  } finally { browser.restore(); }
});

test('a hidden tab schedules nothing, and the drift resumes where it paused', () => {
  const browser = fakeBrowser();
  try {
    mountHead(browser.canvas, drawing);
    browser.run(2);
    const before = browser.latest(), counts = { ...browser.counts };
    browser.hide(true);
    browser.run(60);
    assert.deepEqual(browser.counts, counts, 'nothing ran while hidden');
    browser.hide(false);
    browser.run(0.5);
    assert.ok(browser.moved(before) < 5, `moved ${browser.moved(before).toFixed(1)} device px on return`);
  } finally { browser.restore(); }
});

test('reduced motion draws one frontal frame and ignores the pointer', () => {
  const browser = fakeBrowser({ reduced: true });
  try {
    mountHead(browser.canvas, drawing);
    browser.pointer(1440, 450);
    browser.run(5);
    assert.deepEqual(browser.counts, { frames: 0, timers: 0, draws: 1 });
  } finally { browser.restore(); }
});

test('without a 2D context there is no head (so no credit either)', () => {
  const browser = fakeBrowser();
  try {
    browser.canvas.getContext = () => null;
    assert.equal(mountHead(browser.canvas, drawing), null);
  } finally { browser.restore(); }
});
