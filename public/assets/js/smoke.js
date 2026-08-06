'use strict';

import { state } from './config.js';
import { SMOKE } from './co2-model.js';

export var Smoke = (function () {
  var canvas = null;
  var ctx = null;
  var rafId = null;
  var running = false;
  var particles = [];
  var emitAccum = 0;
  var lastNow = 0;

  function ensure(map) {
    if (canvas) return;
    var container = map.getContainer();
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function size(map) {
    var w = map.getContainer().clientWidth;
    var h = map.getContainer().clientHeight;
    var dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function emit(sources, dt) {
    emitAccum += dt * SMOKE.ratePerSource;
    var need = Math.floor(emitAccum);
    emitAccum -= need;
    if (need <= 0) return;
    for (var si = 0; si < sources.length; si++) {
      var s = sources[si];
      while (need > 0) {
        if (particles.length >= SMOKE.max) return;
        particles.push({
          lat: s.lat,
          lng: s.lng,
          x: 0,
          y: (Math.random() - 0.5) * 40,
          phase: Math.random() * Math.PI * 2,
          turb: SMOKE.turb * (0.5 + Math.random()),
          born: performance.now(),
          life: SMOKE.lifeMin + Math.random() * (SMOKE.lifeMax - SMOKE.lifeMin),
          size: SMOKE.sizeMin + Math.random() * (SMOKE.sizeMax - SMOKE.sizeMin),
          speed: 0.75 + Math.random() * 0.5,
        });
        need--;
      }
    }
  }

  function update(now, dt) {
    var plumeDeg = (state.co2.windDir + 180) % 360;
    var rad = plumeDeg * Math.PI / 180;
    var sinR = Math.sin(rad), cosR = Math.cos(rad);
    var u = Math.max(state.co2.windSpeed, 0.5);
    var degLat = 111320;
    var alive = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var age = (now - p.born) / 1000;
      if (age > p.life) continue;
      p.x += u * p.speed * dt;
      p.y += Math.sin(age * 0.7 + p.phase) * p.turb * dt;
      var east = p.x * sinR + p.y * cosR;
      var north = p.x * cosR - p.y * sinR;
      p.lat = p.lat + north / degLat;
      p.lng = p.lng + east / (degLat * Math.cos(p.lat * Math.PI / 180));
      alive.push(p);
    }
    particles = alive;
  }

  function draw(map) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var t = (performance.now() - p.born) / 1000 / p.life;
      var alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      alpha = Math.max(0, Math.min(1, alpha));
      var pt = map.latLngToContainerPoint(L.latLng(p.lat, p.lng));
      var size = p.size * (1 + t * 0.8);
      ctx.fillStyle = 'rgba(200,208,214,' + (alpha * 0.28).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(235,240,244,' + (alpha * 0.45).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(map) {
    if (!running) return;
    if (!state.co2.sources.length) { stop(); return; }
    var now = performance.now();
    var dt = Math.min((now - lastNow) / 1000, 0.1);
    lastNow = now;
    size(map);
    emit(state.co2.sources, dt);
    update(now, dt);
    draw(map);
    rafId = requestAnimationFrame(function () { frame(map); });
  }

  function start(map) {
    if (running) return;
    running = true;
    ensure(map);
    lastNow = performance.now();
    rafId = requestAnimationFrame(function () { frame(map); });
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = [];
  }

  return { start: start, stop: stop };
})();
