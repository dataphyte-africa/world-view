'use strict';

var cfg = {};
try {
  var cfgEl = document.getElementById('worldview-config');
  cfg = (cfgEl && JSON.parse(cfgEl.textContent)) || window.WORLDVIEW_CONFIG || {};
} catch (e) {
  cfg = {};
}
var prefix = cfg.routePrefix != null ? cfg.routePrefix : 'world-view';
var prefixPath = function (p) { return prefix ? '/' + prefix + p : p; };

export var C = {
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  api: {
    health: prefixPath('/health'),
    pins: prefixPath('/pins'),
    co2: prefixPath('/co2'),
  },
  weatherEnabled: !!cfg.weatherEnabled,
  weatherInterval: cfg.weatherInterval || 60000,
};

export var state = {
  map: null,
  rotate: false,
  toastTimer: null,
  pins: cfg.pins || [],
  heatmapLayer: null,
  pinMarkers: {},
  pinMode: false,
  pendingPin: null,
  showHeatmap: true,
  heatmapTimer: null,
  kmlLayer: null,
  co2: {
    enabled: false,
    sources: [],
    nextId: 1,
    windDir: 180,
    windSpeed: 2.85,
    stability: 'C',
    layer: null,
    liveWeather: false,
    liveTimer: null,
  },
  co2Timer: null,
};

export var apiUrl = function (path) { return C.api.pins + path; };

export var store = new EventTarget();

export function commit(path, value) {
  var keys = path.split('.');
  var target = state;
  for (var i = 0; i < keys.length - 1; i++) target = target[keys[i]];
  target[keys[keys.length - 1]] = value;
  store.dispatchEvent(new CustomEvent('change', { detail: { path: path, value: value } }));
}

export function on(path, fn) {
  var handler = function (e) {
    if (e.detail.path === path) fn(e.detail.value, state);
  };
  store.addEventListener('change', handler);
  return function () { store.removeEventListener('change', handler); };
}

export { cfg, prefixPath };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}
