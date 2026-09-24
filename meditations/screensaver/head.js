// A faint, crosshatched head of Marcus Aurelius behind the passage. Each stroke
// carries a depth, so a small rotation reads as the head turning toward the
// pointer rather than the drawing tilting. Pure functions are exported for tests.

const DEG = Math.PI / 180;
export const MAX_YAW = 8 * DEG;
export const MAX_PITCH = 5 * DEG;
export const DRIFT_YAW = 1.2 * DEG;
export const DRIFT_PITCH = 0.6 * DEG;
const STIFFNESS = 2.5; // critically damped: settles in about two seconds
const MARGIN = 0.04;   // canvas margin around the drawing, for turned poses
const REST = { yaw: 0, pitch: 0 };

// Orthographic rotation about the pivot (the origin). Yaw turns him toward the
// viewer's right, pitch makes him look down; (0, 0) reproduces the drawing.
export function project(vertices, yaw, pitch, out = new Float32Array((vertices.length / 3) * 2)) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0, j = 0; i < vertices.length; i += 3, j += 2) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    out[j] = x * cy + z * sy;
    out[j + 1] = y * cp + (z * cy - x * sy) * sp;
  }
  return out;
}

// Pointer offset from the head's centre, in half-viewports, to where he looks.
// tanh eases into the limits instead of clamping hard.
export function gazeTarget(dx, dy) {
  return { yaw: MAX_YAW * Math.tanh(1.5 * dx), pitch: MAX_PITCH * Math.tanh(1.5 * dy) };
}

// One exact step of a critically damped spring: any dt, no overshoot from rest.
export function springStep({ x, v }, target, dt) {
  const c1 = x - target, c2 = v + STIFFNESS * c1, decay = Math.exp(-STIFFNESS * dt);
  return { x: target + (c1 + c2 * dt) * decay, v: (c2 - STIFFNESS * (c1 + c2 * dt)) * decay };
}

// Barely visible, and never obviously looping (53 s × 37 s ≈ 33 minutes).
export function drift(seconds) {
  return {
    yaw: DRIFT_YAW * Math.sin((2 * Math.PI * seconds) / 53),
    pitch: DRIFT_PITCH * Math.sin((2 * Math.PI * seconds) / 37 + 1.3),
  };
}

// Strokes are stored in half units as [x0, y0, z0, dx, dy, dz, …]: the first end
// relative to the pivot, the second relative to the first.
export function strokeVertices(strokes) {
  const vertices = new Float32Array(strokes.length);
  for (let i = 0; i < strokes.length; i += 6) {
    for (let k = i; k < i + 3; k++) {
      vertices[k] = strokes[k] / 2;
      vertices[k + 3] = (strokes[k] + strokes[k + 3]) / 2;
    }
  }
  return vertices;
}

// Draws the head on `canvas` and animates it: toward the pointer (mouse and pen),
// back to the viewer on rest(), with a slow drift. Reduced motion: one still frame.
// Returns null when the canvas cannot draw.
export function mountHead(canvas, drawing) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const vertices = strokeVertices(drawing.strokes);
  const points = new Float32Array((vertices.length / 3) * 2);
  let reach = 0; // the farthest vertex bounds how far any stroke can move
  for (let i = 0; i < vertices.length; i += 3) {
    reach = Math.max(reach, Math.hypot(vertices[i], vertices[i + 1], vertices[i + 2]));
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let start = performance.now(), last = start, hiddenAt = start; // may mount in a background tab
  let yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 }, target = REST;
  let shown, color, frame = 0, timer = 0, resizeFrame = 0;
  let scale = 1, originX = 0, originY = 0, pivotX = 0, pivotY = 0;

  // Fit the viewport height or, on narrow portrait screens, the width (a little
  // hair may crop). CSS centres the canvas.
  function layout() {
    const ratio = Math.min(2, devicePixelRatio || 1);
    const unit = Math.min((innerHeight * 0.94) / drawing.height, (innerWidth * 1.15) / drawing.width);
    const width = drawing.width * unit * (1 + 2 * MARGIN), height = drawing.height * unit * (1 + 2 * MARGIN);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    scale = unit * ratio;
    originX = (drawing.width * MARGIN + drawing.pivot[0]) * scale;
    originY = (drawing.height * MARGIN + drawing.pivot[1]) * scale;
    pivotX = (innerWidth - width) / 2 + originX / ratio;
    pivotY = (innerHeight - height) / 2 + originY / ratio;
  }
  function draw(pose) {
    project(vertices, pose.yaw, pose.pitch, points);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = color;
    context.lineWidth = drawing.lineWidth * scale;
    context.lineCap = 'round';
    context.beginPath();
    for (let i = 0; i < points.length; i += 4) {
      context.moveTo(originX + points[i] * scale, originY + points[i + 1] * scale);
      context.lineTo(originX + points[i + 2] * scale, originY + points[i + 3] * scale);
    }
    context.stroke();
    shown = pose;
  }
  function pose(now) {
    const sway = drift((now - start) / 1000);
    return { yaw: yaw.x + sway.yaw, pitch: pitch.x + sway.pitch };
  }
  function redraw() {
    color = getComputedStyle(canvas).color;
    draw(motion.matches ? REST : shown ?? pose(performance.now()));
    canvas.classList.add('ready');
  }
  // Settled once what is left of the turn would move no stroke a quarter of a
  // device pixel; the spring coasts about v / STIFFNESS beyond where it is.
  function settled() {
    const left = Math.abs(yaw.x - target.yaw) + Math.abs(pitch.x - target.pitch)
      + (Math.abs(yaw.v) + Math.abs(pitch.v)) / STIFFNESS;
    return reach * scale * left < 0.25;
  }
  // Draws only when some stroke would move more than `threshold` device pixels.
  function tick(threshold) {
    frame = timer = 0;
    const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    yaw = springStep(yaw, target.yaw, dt);
    pitch = springStep(pitch, target.pitch, dt);
    const next = pose(now);
    if (reach * scale * (Math.abs(next.yaw - shown.yaw) + Math.abs(next.pitch - shown.pitch)) > threshold) draw(next);
    schedule();
  }
  // Animation frames and quarter-pixel steps while he turns; a slow timer and
  // whole-pixel steps (invisible at this opacity) while only the drift moves him.
  function schedule() {
    if (frame || timer || document.hidden || motion.matches) return;
    if (settled()) timer = setTimeout(tick, 125, 1);
    else frame = requestAnimationFrame(() => tick(0.25));
  }
  function stop() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = 0;
  }
  function look(next) {
    target = next;
    clearTimeout(timer);
    timer = 0;
    schedule();
  }

  addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || motion.matches) return;
    look(gazeTarget((event.clientX - pivotX) / (innerWidth / 2), (event.clientY - pivotY) / (innerHeight / 2)));
  }, { passive: true });
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { layout(); redraw(); });
  });
  // Pause the drift's clock while hidden, so he does not jump on return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); hiddenAt = performance.now(); }
    else { const away = performance.now() - hiddenAt; start += away; last += away; schedule(); }
  });
  motion.addEventListener('change', () => { stop(); redraw(); schedule(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);

  layout();
  redraw();
  schedule();
  return { rest: () => look(REST), redraw };
}
