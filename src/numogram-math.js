export const VIEW = {size: 720, centerX: 360, centerY: 360, distance: 940};
export const GLOBE_RADIUS = 208;
export const IDENTITY = [0, 0, 0, 1];

export function normalizeQuaternion(q) {
  const length = Math.hypot(...q) || 1;
  return q.map(value => value / length);
}

export function multiplyQuaternion(a, b) {
  return normalizeQuaternion([
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ]);
}

export function axisAngle(axis, angle) {
  const length = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const half = angle / 2, sine = Math.sin(half) / length;
  return [axis.x * sine, axis.y * sine, axis.z * sine, Math.cos(half)];
}

export function rotatePoint(point, quaternion = IDENTITY) {
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * point.z - qz * point.y);
  const ty = 2 * (qz * point.x - qx * point.z);
  const tz = 2 * (qx * point.y - qy * point.x);
  return {
    x: point.x + qw * tx + qy * tz - qz * ty,
    y: point.y + qw * ty + qz * tx - qx * tz,
    z: point.z + qw * tz + qx * ty - qy * tx
  };
}

export function projectPoint(point, view = VIEW) {
  const depth = view.distance - point.z;
  if (depth <= 1 || !Number.isFinite(depth)) return null;
  const scale = view.distance / depth;
  return {x: view.centerX + point.x * scale, y: view.centerY + point.y * scale, z: point.z, scale};
}

export function createModel(themes, radius = GLOBE_RADIUS) {
  const angle = Math.PI * (3 - Math.sqrt(5));
  return themes.map((theme, index) => {
    const y = 1 - 2 * (index + .5) / themes.length;
    const circle = Math.sqrt(1 - y * y), longitude = index * angle + .4;
    return {...theme, x: Math.cos(longitude) * circle * radius, y: y * radius, z: Math.sin(longitude) * circle * radius,
      radius: [36, 39, 33, 42, 37, 40, 34, 38, 35, 43][index % 10]};
  });
}

export function sphericalArc(a, b, t, lift = 5) {
  const radiusA = Math.hypot(a.x, a.y, a.z), radiusB = Math.hypot(b.x, b.y, b.z);
  const dot = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (radiusA * radiusB)));
  const angle = Math.acos(dot), sine = Math.sin(angle);
  let point;
  if (Math.abs(sine) > .00001) {
    const start = Math.sin((1 - t) * angle) / sine, end = Math.sin(t * angle) / sine;
    point = {x: a.x * start + b.x * end, y: a.y * start + b.y * end, z: a.z * start + b.z * end};
  } else {
    point = {x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t, z: a.z * (1 - t) + b.z * t};
    if (Math.hypot(point.x, point.y, point.z) < .00001) point = {x: -a.y || radiusA, y: a.x, z: 0};
  }
  const targetRadius = radiusA * (1 - t) + radiusB * t + Math.sin(Math.PI * t) * lift;
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return {x: point.x * targetRadius / length, y: point.y * targetRadius / length, z: point.z * targetRadius / length};
}

export function buildScene(model, links, orientation) {
  const nodes = model.map((node, index) => {
    const rotated = rotatePoint(node, orientation), projected = projectPoint(rotated);
    return {...node, ...projected, index, projectedRadius: node.radius * projected.scale, depth: rotated.z};
  });
  const segments = [];
  links.forEach((link, index) => {
    const a = typeof link[0] === 'number' ? model[link[0]] : model.find(node => node.id === link[0]);
    const b = typeof link[1] === 'number' ? model[link[1]] : model.find(node => node.id === link[1]);
    if (!a || !b) return;
    const steps = 16;
    for (let step = 0; step < steps; step++) {
      const start = projectPoint(rotatePoint(sphericalArc(a, b, step / steps), orientation));
      const end = projectPoint(rotatePoint(sphericalArc(a, b, (step + 1) / steps), orientation));
      segments.push({key: `edge-${index}-${step}`, type: 'edge', x1: start.x, y1: start.y, x2: end.x, y2: end.y,
        depth: (start.z + end.z) / 2, a: a.id, b: b.id});
    }
  });
  const items = [...segments, ...nodes.map(node => ({...node, key: `node-${node.id}`, type: 'node'}))]
    .sort((a, b) => a.depth - b.depth);
  return {nodes, items};
}

export function hitTest(nodes, x, y, minimumRadius = 24) {
  return [...nodes].sort((a, b) => b.depth - a.depth)
    .find(node => Math.hypot(x - node.x, y - node.y) <= Math.max(node.projectedRadius, minimumRadius));
}

export function beginGesture({pointerId, x, y, pointerType = 'mouse', orientation = IDENTITY}) {
  return {pointerId, pointerType, startX: x, startY: y, x, y, orientation: [...orientation], status: 'pending'};
}

export function advanceGesture(gesture, {pointerId, x, y}, sensitivity = .008) {
  if (!gesture || pointerId !== gesture.pointerId || gesture.status === 'scrolling') return gesture;
  const dx = x - gesture.startX, dy = y - gesture.startY;
  if (gesture.status === 'pending' && Math.hypot(dx, dy) < 7) return {...gesture, x, y};
  if (gesture.status === 'pending' && gesture.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.2)
    return {...gesture, x, y, status: 'scrolling'};
  const yaw = axisAngle({x: 0, y: 1, z: 0}, (x - gesture.x) * sensitivity);
  const pitch = axisAngle({x: 1, y: 0, z: 0}, -(y - gesture.y) * sensitivity);
  return {...gesture, x, y, status: 'dragging', orientation: multiplyQuaternion(pitch, multiplyQuaternion(yaw, gesture.orientation))};
}

export function finishGesture(gesture, pointerId, canceled = false) {
  if (!gesture || pointerId !== gesture.pointerId) return null;
  return {activate: !canceled && gesture.status === 'pending', orientation: gesture.orientation};
}

// Scheduling is separate from React so all pause and cleanup paths have deterministic tests.
export function createMotionLoop({requestFrame, cancelFrame, onFrame, frameInterval = 1000 / 30}) {
  let frame = null, running = false, disposed = false, previous = null, lastPaint = null;
  const tick = time => {
    frame = null;
    if (!running || disposed) return;
    if (lastPaint === null || time - lastPaint >= frameInterval) {
      const delta = previous === null ? 0 : Math.min((time - previous) / 1000, .06);
      previous = time; lastPaint = time; onFrame(delta, time);
    }
    if (running && !disposed) frame = requestFrame(tick);
  };
  return {
    setRunning(next) {
      if (disposed || running === Boolean(next)) return;
      running = Boolean(next); previous = null; lastPaint = null;
      if (running && frame === null) frame = requestFrame(tick);
      if (!running && frame !== null) {cancelFrame(frame); frame = null;}
    },
    dispose() {disposed = true; running = false; if (frame !== null) cancelFrame(frame); frame = null;},
    get running() {return running;}
  };
}
