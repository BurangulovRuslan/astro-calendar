const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
export const FRAME_MS = 1000 / 24;

// The catalogue describes directions on one celestial sphere, not invented
// stellar distances. Rigid camera rotation preserves those angular positions.
export function equatorialVector(rightAscension, declination) {
  const ra = rightAscension * DEG;
  const dec = declination * DEG;
  const latitude = Math.cos(dec);
  return [latitude * Math.cos(ra), Math.sin(dec), latitude * Math.sin(ra)];
}

export function rotateVector(vector, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x = vector[0] * cy + vector[2] * sy;
  const z = -vector[0] * sy + vector[2] * cy;
  return [x, vector[1] * cp - z * sp, vector[1] * sp + z * cp];
}

export function projectVector(vector, width, height) {
  if (vector[2] < -0.28 || width <= 0 || height <= 0) return null;
  const scale = Math.min(width, height) * 0.8 / (1 + vector[2]);
  const x = width / 2 + vector[0] * scale;
  const y = height / 2 - vector[1] * scale;
  if (x < -24 || x > width + 24 || y < -24 || y > height + 24) return null;
  return [x, y, vector[2]];
}

export function magnitudeAppearance(magnitude) {
  const light = Math.sqrt(Math.pow(10, -0.18 * (magnitude + 1.46)));
  return {
    radius: 0.5 + 1.8 * light,
    opacity: Math.min(1, 0.29 + 0.7 * light),
  };
}

export function skyOrientation(clock, parallaxX = 0, parallaxY = 0) {
  return {
    yaw: -0.15 + clock * 0.00002 + parallaxX,
    pitch: -0.16 + Math.sin(clock * 0.000003) * 0.045 + parallaxY,
  };
}

export function sphericalLine(coordinates) {
  const points = [];
  for (let i = 1; i < coordinates.length; i++) {
    const a = equatorialVector(coordinates[i - 1][0], coordinates[i - 1][1]);
    const b = equatorialVector(coordinates[i][0], coordinates[i][1]);
    const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    const divisions = Math.max(1, Math.ceil(angle / (4 * DEG)));
    if (i === 1) points.push(a);
    for (let j = 1; j <= divisions; j++) {
      const t = j / divisions;
      const vector = a.map((value, k) => value * (1 - t) + b[k] * t);
      const length = Math.hypot(...vector);
      if (length > 1e-8) points.push(vector.map(value => value / length));
    }
  }
  return points;
}

const inertRenderer = () => ({ destroy() {}, redraw() {} });

export function createSkyRenderer(canvas, catalog, environment = {}) {
  if (!canvas || !Array.isArray(catalog?.stars)) return inertRenderer();
  const doc = environment.document || canvas.ownerDocument;
  const view = environment.window || doc?.defaultView;
  if (!doc || !view) return inertRenderer();
  const context = canvas.getContext?.('2d', { alpha: false });
  if (!context) return inertRenderer();

  const stars = catalog.stars.filter(star =>
    Array.isArray(star) && star.slice(1, 4).length === 3 && star.slice(1, 4).every(Number.isFinite)
  ).map(star => ({
    vector: equatorialVector(star[1], star[2]),
    magnitude: star[3],
    appearance: magnitudeAppearance(star[3]),
    phase: (Number(star[0]) || 0) * 0.61803398875,
  }));
  const lines = (catalog.constellations || []).flatMap(constellation =>
    (constellation.lines || []).map(sphericalLine)
  );
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  const coarsePointer = view.matchMedia?.('(pointer: coarse)') || { matches: false };
  let width = 1, height = 1, dpr = 1, background;
  let frame = 0, lastPaint = -Infinity, clock = 0, lastClock = null;
  let pointerX = 0, pointerY = 0, parallaxX = 0, parallaxY = 0;
  let active = false, destroyed = false, resizePending = false;
  const glow = doc.createElement('canvas');
  glow.width = glow.height = 64;
  const glowContext = glow.getContext?.('2d');
  if (glowContext) {
    const gradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(218,255,239,0.92)');
    gradient.addColorStop(0.11, 'rgba(115,255,210,0.46)');
    gradient.addColorStop(0.38, 'rgba(46,223,171,0.13)');
    gradient.addColorStop(1, 'rgba(46,223,171,0)');
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 64, 64);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width || view.innerWidth || 1);
    height = Math.max(1, bounds.height || view.innerHeight || 1);
    dpr = Math.min(view.devicePixelRatio || 1, width <= 768 || coarsePointer.matches ? 1.5 : 1.75);
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    background = context.createRadialGradient(width * 0.45, height * 0.38, 0, width * 0.45, height * 0.38, Math.max(width, height));
    background.addColorStop(0, '#03170f');
    background.addColorStop(0.55, '#010b08');
    background.addColorStop(1, '#000403');
    resizePending = false;
  }

  function draw() {
    if (destroyed) return;
    if (resizePending) resize();
    const { yaw, pitch } = skyOrientation(clock, parallaxX, parallaxY);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    function project(vector) {
      const x = vector[0] * cy + vector[2] * sy;
      const z = -vector[0] * sy + vector[2] * cy;
      return projectVector([x, vector[1] * cp - z * sp, vector[1] * sp + z * cp], width, height);
    }
    context.globalAlpha = 1;
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.beginPath();
    for (const line of lines) {
      let previous = null;
      for (const vector of line) {
        const point = project(vector);
        if (point) {
          if (previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) < Math.max(width, height) * 0.2) {
            context.lineTo(point[0], point[1]);
          } else context.moveTo(point[0], point[1]);
        }
        previous = point;
      }
    }
    context.strokeStyle = 'rgba(95,190,157,0.29)';
    context.lineWidth = 0.7;
    context.stroke();

    // Bucket small stellar cores into a handful of fills. Only bright stars
    // receive glow sprites, keeping a full catalogue affordable on phones.
    const buckets = Array.from({ length: 8 }, () => []);
    for (const star of stars) {
      const point = project(star.vector);
      if (!point) continue;
      const twinkle = motion.matches ? 1 : 0.93 + Math.sin(clock * 0.0012 + star.phase) * 0.07;
      const opacity = star.appearance.opacity * twinkle;
      buckets[Math.min(7, Math.max(0, Math.floor(opacity * 8)))].push([point, star.appearance.radius]);
      if (glowContext && star.magnitude < 2.6) {
        const size = 17 + star.appearance.radius * 9;
        context.globalAlpha = opacity * 0.78;
        context.drawImage(glow, point[0] - size / 2, point[1] - size / 2, size, size);
      }
    }
    for (const [index, bucket] of buckets.entries()) {
      if (!bucket.length) continue;
      context.beginPath();
      for (const [point, radius] of bucket) {
        context.moveTo(point[0] + radius, point[1]);
        context.arc(point[0], point[1], radius, 0, TAU);
      }
      context.globalAlpha = (index + 0.5) / 8;
      context.fillStyle = index > 4 ? '#dffff1' : '#83d7ba';
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function tick(now) {
    frame = 0;
    if (!active || destroyed || doc.hidden || motion.matches) return;
    if (now - lastPaint >= FRAME_MS) {
      if (lastClock !== null) clock += Math.min(100, Math.max(0, now - lastClock));
      lastClock = now;
      lastPaint = now;
      parallaxX += (pointerX - parallaxX) * 0.05;
      parallaxY += (pointerY - parallaxY) * 0.05;
      draw();
    }
    frame = view.requestAnimationFrame(tick);
  }

  function stop() {
    active = false;
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    lastClock = null;
    lastPaint = -Infinity;
  }

  function resume() {
    stop();
    if (destroyed || doc.hidden) return;
    active = true;
    draw();
    if (!motion.matches) frame = view.requestAnimationFrame(tick);
  }

  function onResize() {
    if (destroyed) return;
    resizePending = true;
    if (motion.matches && !doc.hidden) draw();
  }

  function onPointerMove(event) {
    if (motion.matches || event.pointerType !== 'mouse') return;
    pointerX = (event.clientX / width - 0.5) * 0.022;
    pointerY = (event.clientY / height - 0.5) * 0.015;
  }

  function onVisibilityChange() { doc.hidden ? stop() : resume(); }
  const observer = view.ResizeObserver ? new view.ResizeObserver(onResize) : null;
  observer?.observe(canvas);
  view.addEventListener('resize', onResize, { passive: true });
  view.addEventListener('pointermove', onPointerMove, { passive: true });
  view.addEventListener('pagehide', stop);
  view.addEventListener('pageshow', resume);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  if (motion.addEventListener) motion.addEventListener('change', resume);
  else motion.addListener?.(resume);
  resize();
  resume();

  return {
    redraw: onResize,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      observer?.disconnect();
      view.removeEventListener('resize', onResize);
      view.removeEventListener('pointermove', onPointerMove);
      view.removeEventListener('pagehide', stop);
      view.removeEventListener('pageshow', resume);
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      if (motion.removeEventListener) motion.removeEventListener('change', resume);
      else motion.removeListener?.(resume);
    },
  };
}
