(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const FRAME_MS = 1000 / 24;
  const TAU = Math.PI * 2;

  // A single rigid celestial sphere; no invented positions or stellar distances.
  function equatorialVector(rightAscension, declination) {
    const ra = rightAscension * DEG;
    const dec = declination * DEG;
    const latitude = Math.cos(dec);
    return [latitude * Math.cos(ra), Math.sin(dec), latitude * Math.sin(ra)];
  }

  function rotateVector(vector, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = vector[0] * cy + vector[2] * sy;
    const z = -vector[0] * sy + vector[2] * cy;
    return [x, vector[1] * cp - z * sp, vector[1] * sp + z * cp];
  }

  // Stereographic view from the opposite pole. Coordinates remain angular,
  // rather than being turned into an arbitrary cloud with random depths.
  function projectVector(vector, width, height) {
    if (vector[2] < -0.28 || width <= 0 || height <= 0) return null;
    const scale = Math.min(width, height) * 0.8 / (1 + vector[2]);
    const x = width / 2 + vector[0] * scale;
    const y = height / 2 - vector[1] * scale;
    if (x < -24 || x > width + 24 || y < -24 || y > height + 24) return null;
    return [x, y, vector[2]];
  }

  function magnitudeAppearance(magnitude) {
    const light = Math.sqrt(Math.pow(10, -0.18 * (magnitude + 1.46)));
    return { radius: 0.33 + 1.55 * light, opacity: Math.min(1, 0.16 + 0.78 * light) };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { equatorialVector, rotateVector, projectVector, magnitudeAppearance };
  }
  if (typeof document === 'undefined') return;

  function start() {
    const canvas = document.getElementById('celestial-sky');
    const catalog = window.ASTRO_SKY;
    if (!canvas || !catalog || !Array.isArray(catalog.stars)) return;
    const context = canvas.getContext && canvas.getContext('2d', { alpha: false });
    if (!context) return;

    const stars = catalog.stars.map(function (star) {
      return { vector: equatorialVector(star[1], star[2]), magnitude: star[3], appearance: magnitudeAppearance(star[3]) };
    });
    const lines = [];
    (catalog.constellations || []).forEach(function (constellation) {
      constellation.lines.forEach(function (line) {
        // Normalized spherical interpolation keeps each segment on the sphere.
        const points = [];
        for (let i = 1; i < line.length; i++) {
          const a = equatorialVector(line[i - 1][0], line[i - 1][1]);
          const b = equatorialVector(line[i][0], line[i][1]);
          const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
          const divisions = Math.max(1, Math.ceil(angle / (4 * DEG)));
          if (i === 1) points.push(a);
          for (let j = 1; j <= divisions; j++) {
            const t = j / divisions;
            const v = a.map(function (value, k) { return value * (1 - t) + b[k] * t; });
            const length = Math.hypot(v[0], v[1], v[2]);
            points.push(v.map(function (value) { return value / length; }));
          }
        }
        lines.push(points);
      });
    });

    const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    let width = 1, height = 1, dpr = 1;
    let frame = 0, lastPaint = 0, clock = 0, lastClock = 0;
    let pointerX = 0, pointerY = 0, parallaxX = 0, parallaxY = 0;
    let active = false, resizePending = false;
    const glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    const glowContext = glow.getContext('2d');
    if (glowContext) {
      const gradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(206,255,220,0.7)');
      gradient.addColorStop(0.12, 'rgba(100,255,153,0.25)');
      gradient.addColorStop(0.42, 'rgba(33,230,113,0.055)');
      gradient.addColorStop(1, 'rgba(33,230,113,0)');
      glowContext.fillStyle = gradient;
      glowContext.fillRect(0, 0, 64, 64);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width || window.innerWidth);
      height = Math.max(1, bounds.height || window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      resizePending = false;
    }

    function draw() {
      if (resizePending) resize();
      const yaw = -0.15 + clock * 0.000004 + parallaxX;
      const pitch = -0.16 + Math.sin(clock * 0.0000012) * 0.025 + parallaxY;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      function view(vector) {
        const x = vector[0] * cy + vector[2] * sy;
        const z = -vector[0] * sy + vector[2] * cy;
        return [x, vector[1] * cp - z * sp, vector[1] * sp + z * cp];
      }
      context.globalAlpha = 1;
      const background = context.createRadialGradient(width * 0.45, height * 0.38, 0, width * 0.45, height * 0.38, Math.max(width, height));
      background.addColorStop(0, '#03150c');
      background.addColorStop(0.55, '#010905');
      background.addColorStop(1, '#000302');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.beginPath();
      lines.forEach(function (line) {
        let previous = null;
        line.forEach(function (vector) {
          const point = projectVector(view(vector), width, height);
          if (point) {
            if (previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) < Math.max(width, height) * 0.2) {
              context.lineTo(point[0], point[1]);
            } else context.moveTo(point[0], point[1]);
          }
          previous = point;
        });
      });
      context.strokeStyle = 'rgba(69,149,103,0.18)';
      context.lineWidth = 0.55;
      context.stroke();

      const buckets = Array.from({ length: 6 }, function () { return []; });
      stars.forEach(function (star) {
        const point = projectVector(view(star.vector), width, height);
        if (!point) return;
        buckets[Math.min(5, Math.max(0, Math.floor(star.appearance.opacity * 6)))].push([point, star.appearance.radius]);
        if (glowContext && star.magnitude < 2.15) {
          const size = 13 + star.appearance.radius * 7;
          context.globalAlpha = star.appearance.opacity * 0.55;
          context.drawImage(glow, point[0] - size / 2, point[1] - size / 2, size, size);
        }
      });
      buckets.forEach(function (bucket, index) {
        context.beginPath();
        bucket.forEach(function (star) {
          context.moveTo(star[0][0] + star[1], star[0][1]);
          context.arc(star[0][0], star[0][1], star[1], 0, TAU);
        });
        context.globalAlpha = (index + 0.5) / 6;
        context.fillStyle = index > 3 ? '#d1ffe0' : '#75b990';
        context.fill();
      });
      context.globalAlpha = 1;
    }

    function tick(now) {
      if (!active || document.hidden || motion.matches) { frame = 0; return; }
      frame = window.requestAnimationFrame(tick);
      if (now - lastPaint < FRAME_MS) return;
      // Hidden tabs do not advance the rotation or allocate animation frames.
      if (lastClock) clock += Math.min(100, now - lastClock);
      lastClock = now;
      lastPaint = now - (now - lastPaint) % FRAME_MS;
      parallaxX += (pointerX - parallaxX) * 0.035;
      parallaxY += (pointerY - parallaxY) * 0.035;
      draw();
    }

    function stop() {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastClock = 0;
    }

    function resume() {
      stop();
      if (document.hidden) return;
      active = true;
      draw();
      if (!motion.matches) frame = window.requestAnimationFrame(tick);
    }

    resize();
    resume();
    window.addEventListener('resize', function () {
      resizePending = true;
      if (motion.matches && !document.hidden) { resize(); draw(); }
    }, { passive: true });
    window.addEventListener('pointermove', function (event) {
      if (motion.matches || event.pointerType !== 'mouse') return;
      pointerX = (event.clientX / width - 0.5) * 0.018;
      pointerY = (event.clientY / height - 0.5) * 0.012;
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : resume(); });
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', resume);
    if (motion.addEventListener) motion.addEventListener('change', resume);
    else if (motion.addListener) motion.addListener(resume);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
