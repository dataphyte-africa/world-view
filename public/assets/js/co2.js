'use strict';

import { state, C, prefixPath, escapeHtml } from './config.js';
import { UI } from './ui.js';
import { CO2_PARAMS, pollutionRadiusMeters } from './co2-model.js';
import { Smoke } from './smoke.js';
import { scheduleHeatmapRender } from './heatmap.js';

export function co2Centroid() {
  var sources = state.co2.sources;
  if (!sources.length) return null;
  var lat = 0, lng = 0;
  sources.forEach(function (s) { lat += s.lat; lng += s.lng; });
  return { lat: lat / sources.length, lng: lng / sources.length };
}

function co2MarkerIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:26px;height:26px;border-radius:50%;' +
      'background:radial-gradient(circle, #fff9c4 0%, #ffd54f 25%, #ff9c00 50%, #ff4d00 75%, rgba(255,61,0,.75) 100%);' +
      'border:2px solid rgba(255,255,255,.9);box-shadow:0 0 12px rgba(255,80,0,.8)"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export function updateCO2Info() {
  var co2 = state.co2;
  var sources = co2.sources;
  if (!sources.length) {
    document.getElementById('co2-info').innerHTML = '';
    document.getElementById('co2-source-status').textContent = 'No sources';
    return;
  }
  var u = co2.windSpeed;
  var downwind = Math.round(pollutionRadiusMeters(u));

  // Update info panel
  var annualTonne = ((CO2_PARAMS.Q / 1000) * 31536000 / 1000).toFixed(0);
  document.getElementById('co2-info').innerHTML =
    '<span style="color:#9aa0a6">community</span> ~' + downwind + 'm' +
    ' &middot; <span style="color:#9aa0a6">Q</span> ' + (CO2_PARAMS.Q / 1000).toFixed(0) + ' kg/s' +
    ' &middot; <span style="color:#9aa0a6">u</span> ' + u.toFixed(1) + ' m/s' +
    ' &middot; <span style="color:#9aa0a6">' + annualTonne + '</span> t/yr' +
    ' &middot; <span style="color:#9aa0a6">' + sources.length + ' source' + (sources.length > 1 ? 's' : '') + '</span>';

  document.getElementById('co2-source-status').textContent = sources.length + ' source' + (sources.length > 1 ? 's' : '') + ' placed';

  // Gray flare-direction arrow beside every pin (points where the flare blows toward)
  var plumeDir = (co2.windDir + 180) % 360;
  var rad = plumeDir * Math.PI / 180;
  var off = 14;
  sources.forEach(function (s) {
    if (s.arrow) { state.map.removeLayer(s.arrow); }
    s.arrow = L.marker([s.lat, s.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:26px;height:26px;position:relative;transform:rotate(' + plumeDir + 'deg)">' +
          '<div style="position:absolute;left:12px;top:1px;width:2px;height:18px;background:#9aa0a6;border-radius:1px;box-shadow:0 0 4px rgba(154,160,166,.9)"></div>' +
          '<div style="position:absolute;left:6px;top:0;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid #9aa0a6;filter:drop-shadow(0 0 3px rgba(154,160,166,.9))"></div>' +
          '</div>',
        iconSize: [26, 26],
        iconAnchor: [12 - off * Math.sin(rad), 12 + off * Math.cos(rad)],
      }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(state.map);
  });
}

function addCO2Source(id, lat, lng, info) {
  var marker = L.marker([lat, lng], { icon: co2MarkerIcon() }).addTo(state.map);
  marker.on('click', function () { openCO2Detail(id, lat, lng); });
  state.co2.sources.push({
    id: id,
    lat: lat,
    lng: lng,
    operator: (info && info.operator) || '',
    location: (info && info.location) || '',
    description: (info && info.description) || '',
    imageUrl: (info && info.imageUrl) || '',
    marker: marker,
    arrow: null,
  });
}

export function openCO2Detail(id, lat, lng) {
  var s = null;
  for (var i = 0; i < state.co2.sources.length; i++) {
    if (state.co2.sources[i].id === id) { s = state.co2.sources[i]; break; }
  }
  var title = s && s.operator ? s.operator : ('Flare Source #' + id);
  document.getElementById('co2-detail-title').textContent = title;

  var body = document.getElementById('co2-detail-body');
  if (!s) {
    body.innerHTML = '<div class="co2-detail-row">No card information yet.</div>';
  } else {
    var rows = '';
    if (s.imageUrl) {
      rows += '<div class="co2-detail-img"><img src="' + escapeHtml(s.imageUrl) + '" alt="' + escapeHtml(title) + '" onerror="this.parentElement.innerHTML=\'<span style=display:block;padding:8px;font-size:11px;color:#9aa0a6>Image failed to load</span>\'"></div>';
    }
    if (s.location) {
      rows += '<div class="co2-detail-row"><span class="co2-detail-label">Location</span><span>' + escapeHtml(s.location) + '</span></div>';
    }
    rows += '<div class="co2-detail-row"><span class="co2-detail-label">Coordinates</span><span class="co2-detail-mono">' + s.lat.toFixed(4) + ', ' + s.lng.toFixed(4) + '</span></div>';
    if (s.description) {
      rows += '<div class="co2-detail-row"><span class="co2-detail-label">Description</span><span class="co2-detail-desc">' + escapeHtml(s.description) + '</span></div>';
    }
    if (!s.imageUrl && !s.location && !s.description && !s.operator) {
      rows = '<div class="co2-detail-row">No card information yet.</div>';
    }
    body.innerHTML = rows;
  }

  document.getElementById('co2-detail-card').classList.add('open');
}

export function closeCO2Detail() {
  var card = document.getElementById('co2-detail-card');
  if (card) card.classList.remove('open');
}

document.getElementById('co2-detail-close').addEventListener('click', closeCO2Detail);

export function flyToCO2(id) {
  var s = null;
  for (var i = 0; i < state.co2.sources.length; i++) {
    if (state.co2.sources[i].id === id) { s = state.co2.sources[i]; break; }
  }
  if (!s || !state.map) return;
  var targetZoom = state.map.getZoom() + Math.log2(2);
  state.map.flyTo([s.lat, s.lng], targetZoom, { duration: 1.2 });
  setTimeout(function () { openCO2Detail(s.id, s.lat, s.lng); }, 1250);
}

function renderCO2List() {
  var list = document.getElementById('co2-list');
  if (!list) return;
  var count = document.getElementById('co2-count');
  var sources = state.co2.sources;
  if (count) count.textContent = '(' + sources.length + ')';
  if (!sources.length) {
    list.innerHTML = '<div class="pin-empty">No sources</div>';
    return;
  }
  list.innerHTML = sources.map(function (s) {
    var name = s.operator || ('Source #' + s.id);
    return '<div class="co2-item" data-id="' + s.id + '" title="Go to flare source">' +
      '<span class="co2-dot"></span>' +
      '<span class="co2-name">' + escapeHtml(name) + '</span>' +
      '<span class="co2-coords">' + s.lat.toFixed(4) + ', ' + s.lng.toFixed(4) + '</span>' +
      '</div>';
  }).join('');
}

export function loadCO2Sources() {
  fetch(C.api.co2, { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (list) {
      if (!Array.isArray(list)) return;
      list.forEach(function (s) {
        if (s.lat == null || s.lng == null) return;
        addCO2Source(s.id, s.lat, s.lng, s);
      });
      if (state.co2.sources.length) {
        state.co2.nextId = Math.max.apply(null, state.co2.sources.map(function (s) { return s.id; })) + 1;
        startLiveWeather();
        Smoke.start(state.map);
      }
      updateCO2Info();
      renderCO2List();
      if (state.showHeatmap) scheduleHeatmapRender();
    })
    .catch(function (err) { console.warn('Failed to load CO\u2082 sources:', err); });
}

export function startLiveWeather() {
  if (!C.weatherEnabled || state.co2.liveWeather) return;
  state.co2.liveWeather = true;
  var btn = document.getElementById('btn-co2-live');
  if (btn) btn.classList.add('active');
  fetchLiveWeather();
  state.co2.liveTimer = setInterval(fetchLiveWeather, C.weatherInterval);
}

export function stopLiveWeather() {
  state.co2.liveWeather = false;
  var btn = document.getElementById('btn-co2-live');
  if (btn) btn.classList.remove('active');
  if (state.co2.liveTimer) { clearInterval(state.co2.liveTimer); state.co2.liveTimer = null; }
  var statusEl = document.getElementById('co2-live-status');
  if (statusEl) statusEl.textContent = '';
}

function fetchLiveWeather() {
  var co2 = state.co2;
  var c = co2Centroid();
  if (!c) return;
  var statusEl = document.getElementById('co2-live-status');
  statusEl.textContent = 'fetching...';
  statusEl.style.color = '#fbbc04';
  fetch(prefixPath('/weather?lat=' + c.lat + '&lng=' + c.lng), { signal: AbortSignal.timeout(15000) })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var parts = [];
      if (data.location) parts.push(data.location);
      if (data.wind_deg != null) {
        co2.windDir = data.wind_deg;
        document.getElementById('co2-wind-dir').value = data.wind_deg;
        document.getElementById('co2-wind-dir-val').textContent = data.wind_deg + '\u00b0';
        parts.push(data.wind_deg + '\u00b0');
      }
      if (data.wind_speed != null) {
        co2.windSpeed = data.wind_speed;
        document.getElementById('co2-wind-speed').value = data.wind_speed;
        document.getElementById('co2-wind-speed-val').textContent = data.wind_speed.toFixed(1) + ' m/s';
        parts.push(data.wind_speed.toFixed(1) + ' m/s');
      }
      if (data.timestamp) {
        parts.push(new Date(data.timestamp * 1000).toLocaleTimeString());
      }
      parts.push('live');
      statusEl.textContent = parts.join(' \u00b7 ');
      statusEl.style.color = '#34a853';
      updateCO2Info();
      if (state.showHeatmap) scheduleHeatmapRender();
    })
    .catch(function (err) {
      statusEl.textContent = 'failed';
      statusEl.style.color = '#ea4335';
      console.warn('Weather fetch:', err.message);
    });
}
