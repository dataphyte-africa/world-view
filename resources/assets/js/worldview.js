(function () {
  'use strict';

  var cfg = window.WORLDVIEW_CONFIG || {};
  var prefix = cfg.routePrefix || 'world-view';

  var C = {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    api: {
      health: '/' + prefix + '/health',
      pins: '/' + prefix + '/pins',
      opensky: '/' + prefix + '/opensky',
    },
    aircraftEnabled: !!cfg.aircraftEnabled,
    acInterval: cfg.fetchInterval || 15000,
    maxAc: cfg.maxAircraft || 1000,
    retryBaseMs: 2000,
    retryMaxMs: 30000,
    weatherEnabled: !!cfg.weatherEnabled,
  };

  var CLR = {
    acLow: '#34a853',
    acMid: '#fbbc04',
    acHigh: '#ea4335',
    acNone: 'rgba(255,255,255,0.3)',
  };

  var M_TO_FT = 3.28084;

  var state = {
    map: null,
    rotate: false,
    toastTimer: null,
    pins: cfg.pins || [],
    heatmapLayer: null,
    pinMarkers: {},
    pinMode: false,
    showHeatmap: false,
    heatmapTimer: null,
    acLayer: null,
    acMarkers: {},
    acSelected: null,
    showAc: C.aircraftEnabled,
    acBusy: false,
    acTimer: null,
    acFailCount: 0,
    acRetryTimer: null,
    kmlLayer: null,
    co2: {
      enabled: false,
      sourceLat: null,
      sourceLng: null,
      windDir: 180,
      windSpeed: 2.85,
      stability: 'C',
      layer: null,
      circles: null,
      sourceMarker: null,
      liveWeather: false,
      liveTimer: null,
    },
    co2Timer: null,
  };

  var apiUrl = function (path) { return C.api.pins + path; };

  // ─── Icons ───
  function makeAcIcon(color, size) {
    size = size || 28;
    return L.divIcon({
      className: 'ac-marker',
      html: '<div class="ac-icon" style="background:' + color + '33;box-shadow:0 0 8px ' + color + '66"><div class="dot" style="border-color:' + color + ';background:' + color + '"></div><div class="arrow" style="border-bottom-color:' + color + '"></div></div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function makeKmlIcon(highlight) {
    return L.divIcon({
      className: 'kml-marker',
      html: '<div class="kml-icon' + (highlight ? ' highlight' : '') + '"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  // ─── UI ───
  var UI = {
    toast: function (msg) {
      var el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
    },

    setStatus: function (status) {
      var dot = document.getElementById('s-dot');
      var txt = document.getElementById('stat-text');
      if (dot) dot.className = 'status-dot ' + status.cls + (status.cls !== 'online' ? ' pulse' : '');
      if (txt) txt.textContent = status.label;
    },

    updateStats: function () {
      var el = document.getElementById('s-air');
      if (el) el.textContent = Object.keys(state.acMarkers).length;
      document.getElementById('b-total').textContent = state.pins.length;
    },

    updateTime: function (time) {
      if (time) document.getElementById('b-time').textContent = new Date(time * 1000).toLocaleTimeString();
    },

    showInfo: function (data) {
      var panel = document.getElementById('info-panel');
      document.getElementById('info-title').innerHTML = data.title + ' <span class="tag ' + data.type + '">' + data.type + '</span>';
      var grid = document.getElementById('info-grid');
      grid.innerHTML = data.rows.map(function (r) {
        return '<div class="row' + (r.full ? ' full' : '') + '"><span class="l">' + r.l + '</span><span class="v">' + (r.v ?? '--') + '</span></div>';
      }).join('');
      panel.classList.add('open');
    },

    hideInfo: function () {
      document.getElementById('info-panel').classList.remove('open');
    },
  };

  // ─── Helpers ───
  function acColor(altM) {
    if (altM == null) return CLR.acNone;
    var ft = altM * M_TO_FT;
    if (ft < 10000) return CLR.acLow;
    if (ft < 30000) return CLR.acMid;
    return CLR.acHigh;
  }

  function acColorCss(altM) {
    var col = acColor(altM);
    if (col === CLR.acNone) return 'rgba(255,255,255,0.3)';
    return col;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  // ─── Pin API ───
  function loadPins() {
    if (!cfg.pinsEnabled) return;
    fetch(apiUrl(''))
      .then(function (r) { return r.json(); })
      .then(function (pins) {
        state.pins = [];
        pins.forEach(function (p) {
          state.pins.push({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            name: p.name,
            imageUrl: p.imageUrl || '',
            createdAt: p.createdAt,
          });
        });
        state.pins.forEach(createPinMarker);
        updatePinList();
      })
      .catch(function (err) { console.warn('Failed to load pins:', err); });
  }

  function savePin(pin) {
    return fetch(apiUrl(''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name: pin.name, lat: pin.lat, lng: pin.lng, imageUrl: pin.imageUrl }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (saved) {
      pin.id = saved.id;
      return pin;
    });
  }

  function deletePinApi(id) {
    return fetch(apiUrl('/' + id), { method: 'DELETE' });
  }

  // ─── Pins ───
  function createPinMarker(pin) {
    if (state.pinMarkers[pin.id]) return;

    var marker = L.marker([pin.lat, pin.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;background:#ea4335;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(state.map);

    marker.bindPopup('<b>' + escapeHtml(pin.name) + '</b><br>' + pin.lat.toFixed(4) + ', ' + pin.lng.toFixed(4));
    marker.pinId = pin.id;

    if (pin.imageUrl) {
      var imgHtml = '<img src="' + escapeHtml(pin.imageUrl) + '" alt="' + escapeHtml(pin.name) + '" onerror="this.parentElement.innerHTML=\'<span style=display:block;padding:8px;font-size:11px;color:#9aa0a6>Image failed to load</span>\'">';
      marker.bindTooltip(imgHtml, {
        direction: 'top',
        offset: L.point(0, -10),
        className: 'pin-img-tooltip',
      });

      var holdTimer = null;
      marker.on('touchstart', function () {
        holdTimer = setTimeout(function () { marker.openTooltip(); }, 500);
      });
      marker.on('touchend touchmove', function () {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      });
    }

    state.pinMarkers[pin.id] = marker;
  }

  function addPin(lat, lng, name, imageUrl) {
    name = (name || '').trim() || ('Pin ' + (state.pins.length + 1));
    var pin = {
      id: 'temp_' + Date.now(),
      lat: lat,
      lng: lng,
      name: name,
      imageUrl: imageUrl || '',
      createdAt: Date.now(),
    };

    createPinMarker(pin);
    state.pins.push(pin);
    updatePinList();
    UI.toast('Pinned ' + name);

    savePin(pin).then(function (saved) {
      pin.id = saved.id;
      state.pinMarkers[saved.id] = state.pinMarkers[pin.id];
      delete state.pinMarkers[pin.id];
      state.pinMarkers[saved.id].pinId = saved.id;
    }).catch(function () {
      UI.toast('Failed to save pin');
    });
  }

  function removePin(id) {
    var pin = state.pins.find(function (p) { return p.id === id; });
    if (!pin) return;

    if (pin.id && typeof pin.id === 'number') {
      deletePinApi(pin.id).catch(function () { UI.toast('Failed to delete pin from server'); });
    }

    state.pins = state.pins.filter(function (p) { return p.id !== id; });
    if (state.pinMarkers[id]) {
      state.map.removeLayer(state.pinMarkers[id]);
      delete state.pinMarkers[id];
    }
    updatePinList();
  }

  function clearAllPins() {
    state.pins.forEach(function (p) {
      if (p.id && typeof p.id === 'number') {
        deletePinApi(p.id).catch(function () {});
      }
    });
    for (var id in state.pinMarkers) {
      if (state.pinMarkers.hasOwnProperty(id)) state.map.removeLayer(state.pinMarkers[id]);
    }
    state.pinMarkers = {};
    state.pins = [];
    updatePinList();
    UI.toast('All pins cleared');
  }

  function updatePinList() {
    var list = document.getElementById('pin-list');
    var count = document.getElementById('pin-count');
    count.textContent = '(' + state.pins.length + ')';
    if (state.pins.length === 0) {
      list.innerHTML = '<div style="color:rgba(255,255,255,.2);font-size:9px;padding:2px 0">No pins yet</div>';
      return;
    }
    list.innerHTML = state.pins.map(function (p) {
      return '<div class="pin-item" data-id="' + p.id + '">' +
        '<span class="pin-dot"></span>' +
        '<span class="pin-img-icon' + (p.imageUrl ? ' has-img' : '') + '" title="' + (p.imageUrl ? 'Has image' : 'No image') + '">' + (p.imageUrl ? '\uD83D\uDDBC' : '') + '</span>' +
        '<span class="pin-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="pin-coords">' + p.lat.toFixed(2) + ', ' + p.lng.toFixed(2) + '</span>' +
        '<button class="pin-del" data-id="' + p.id + '" title="Remove pin">&times;</button>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.pin-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('pin-del')) return;
        var pid = this.dataset.id;
        var pin = state.pins.find(function (p) { return p.id == pid; });
        if (pin) state.map.flyTo([pin.lat, pin.lng], 13, { duration: 1.5 });
      });
    });
    list.querySelectorAll('.pin-del').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); removePin(this.dataset.id); });
    });
  }

  // ─── Aircraft ───
  function upsertAc(s) {
    var id = s[0], cs = s[1], lon = s[5], lat = s[6], baroAlt = s[7], vel = s[9], hdg = s[10], vrate = s[11], geoAlt = s[13];
    if (lon == null || lat == null) return;
    var altM = baroAlt != null ? baroAlt : geoAlt;
    var altFt = altM != null ? Math.round(altM * M_TO_FT) : null;
    var color = acColorCss(altM);
    var label = (cs || '').trim() || id.slice(-6).toUpperCase();

    var marker = state.acMarkers[id];
    if (!marker) {
      if (Object.keys(state.acMarkers).length >= C.maxAc) return;
      var icon = makeAcIcon(color);
      marker = L.marker([lat, lon], { icon: icon }).addTo(state.acLayer);
      marker.acData = { altFt: altFt, vel: vel, hdg: hdg, vrate: vrate, lat: lat, lon: lon, color: color };
      marker.bindPopup(label + '<br>' + (altFt != null ? altFt.toLocaleString() + ' ft' : '--') + ' | ' + (vel != null ? Math.round(vel * 1.94384) + ' kn' : '--'));
      marker.on('click', function () { showAcInfo(marker, id); });
      state.acMarkers[id] = marker;
    } else {
      marker.setLatLng([lat, lon]);
      marker.acData = { altFt: altFt, vel: vel, hdg: hdg, vrate: vrate, lat: lat, lon: lon, color: color };
      marker.setIcon(makeAcIcon(color));
      marker.setPopupContent(label + '<br>' + (altFt != null ? altFt.toLocaleString() + ' ft' : '--') + ' | ' + (vel != null ? Math.round(vel * 1.94384) + ' kn' : '--'));
    }
  }

  function cleanAc(active) {
    var s = new Set(active);
    for (var id in state.acMarkers) {
      if (state.acMarkers.hasOwnProperty(id) && !s.has(id)) {
        state.acLayer.removeLayer(state.acMarkers[id]);
        delete state.acMarkers[id];
      }
    }
  }

  function showAcInfo(marker, id) {
    if (state.acSelected && state.acSelected !== marker) resetColors();
    var d = marker.acData || {};
    state.acSelected = marker;
    marker.setIcon(makeAcIcon('#8ab4f8'));
    UI.showInfo({
      type: 'air',
      title: marker.getPopupContent().split('<br>')[0] || '--',
      rows: [
        { l: 'ICAO', v: id },
        { l: 'Altitude', v: d.altFt != null ? d.altFt.toLocaleString() + ' ft' : '--' },
        { l: 'Speed', v: d.vel != null ? Math.round(d.vel * 1.94384) + ' kn' : '--' },
        { l: 'Heading', v: d.hdg != null ? Math.round(d.hdg) + '\u00b0' : '--' },
        { l: 'V. Rate', v: d.vrate != null ? Math.round(d.vrate * 196.85) + ' ft/min' : '--' },
        { l: 'Position', v: d.lat != null ? d.lat.toFixed(2) + ', ' + d.lon.toFixed(2) : '--', full: true },
      ],
    });
  }

  function resetColors() {
    if (!state.acSelected) return;
    var d = state.acSelected.acData;
    if (d && d.color) state.acSelected.setIcon(makeAcIcon(d.color));
    state.acSelected = null;
  }

  function fetchAc() {
    if (state.acBusy) return;
    state.acBusy = true;
    fetch(C.api.opensky + '/states/all', { signal: AbortSignal.timeout(15000) })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        state.acFailCount = 0;
        if (d.states && Array.isArray(d.states)) {
          var ids = [];
          for (var i = 0; i < d.states.length; i++) {
            var s = d.states[i];
            if (s[5] != null && s[6] != null) { upsertAc(s); ids.push(s[0]); }
          }
          cleanAc(ids);
          UI.setStatus({ cls: 'online', label: 'Live' });
          if (d.time) UI.updateTime(d.time);
          UI.updateStats();
        }
      })
      .catch(function (e) {
        state.acFailCount++;
        console.warn('AC fetch (' + state.acFailCount + 'x):', e.message);
        if (state.acFailCount >= 3) {
          UI.setStatus({ cls: 'offline', label: 'Offline' });
        } else {
          UI.setStatus({ cls: 'stale', label: 'Retrying...' });
        }
        scheduleAcRetry();
      })
      .finally(function () { state.acBusy = false; });
  }

  function scheduleAcRetry() {
    clearTimeout(state.acRetryTimer);
    var delay = Math.min(C.retryBaseMs * Math.pow(2, state.acFailCount), C.retryMaxMs);
    state.acRetryTimer = setTimeout(fetchAc, delay);
  }

  // ─── KML ───
  function loadKml() {
    var features = cfg.kmlFeatures || [];
    if (features.length === 0) return;

    state.kmlLayer = L.layerGroup().addTo(state.map);

    features.forEach(function (f) {
      var icon = makeKmlIcon(f.is_highlighted);
      var marker = L.marker([f.latitude, f.longitude], { icon: icon }).addTo(state.kmlLayer);
      marker.bindPopup('<b>' + escapeHtml(f.name) + '</b>' + (f.is_highlighted ? '<br><span style="color:#ea4335">Affected area</span>' : ''));
    });

    var b = cfg.kmlBounds;
    if (b) {
      var bounds = L.latLngBounds(
        L.latLng(b.south, b.west),
        L.latLng(b.north, b.east)
      );
      if (bounds.isValid()) state.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 12, duration: 2 });
    }
  }

  // ─── Heatmap (CO2 Dispersion) ───
  // The heatmap renders the Gaussian plume concentration from the CO2 dispersion model.
  // Toggle with the "Heat" button; adjust parameters via the "CO2" panel.

  function renderHeatmap() {
    if (state.heatmapTimer) clearTimeout(state.heatmapTimer);
    state.heatmapTimer = setTimeout(doRenderHeatmap, 80);
  }

  function doRenderHeatmap() {
    if (state.heatmapLayer) { state.map.removeLayer(state.heatmapLayer); state.heatmapLayer = null; }
    if (!state.showHeatmap) return;

    var srcLat = state.co2.sourceLat;
    var srcLng = state.co2.sourceLng;
    if (srcLat == null) {
      UI.toast('Click map to place CO\u2082 source');
      return;
    }

    var u = state.co2.windSpeed;
    var stability = state.co2.stability;
    var Q = CO2_PARAMS.Q;
    var he = CO2_PARAMS.he;
    var plumeDir = (state.co2.windDir + 180) % 360;
    var theta = plumeDir * Math.PI / 180;
    var cosT = Math.cos(theta), sinT = Math.sin(theta);

    var degLat = 111320;
    var degLng = 111320 * Math.cos(srcLat * Math.PI / 180);
    var maxExtent = CO2_PARAMS.maxExtent;
    var downwind = Math.min(maxExtent, maxExtent * (2.5 / Math.max(u, 0.5)));
    var crosswind = Math.round(downwind * 0.45);
    var upwind = Math.round(downwind * 0.1);

    function meterToLatLng(mx, my) {
      var east = mx * sinT + my * cosT;
      var north = mx * cosT - my * sinT;
      return { lat: srcLat + north / degLat, lng: srcLng + east / degLng };
    }

    var corners = [
      meterToLatLng(-upwind, -crosswind),
      meterToLatLng(downwind, -crosswind),
      meterToLatLng(downwind, crosswind),
      meterToLatLng(-upwind, crosswind),
    ];
    var lats = corners.map(function (c) { return c.lat; });
    var lngs = corners.map(function (c) { return c.lng; });
    var bounds = L.latLngBounds(
      L.latLng(Math.min.apply(null, lats), Math.min.apply(null, lngs)),
      L.latLng(Math.max.apply(null, lats), Math.max.apply(null, lngs))
    );

    var cw = 400, ch = 300;
    var canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext('2d');
    var imgData = ctx.createImageData(cw, ch);
    var data = imgData.data;

    var bN = bounds.getNorth(), bS = bounds.getSouth();
    var bW = bounds.getWest(), bE = bounds.getEast();
    var maxC = 0, conc = new Float32Array(cw * ch);

    for (var py = 0; py < ch; py++) {
      for (var px = 0; px < cw; px++) {
        var lat = bN - (py / ch) * (bN - bS);
        var lng = bW + (px / cw) * (bE - bW);
        var east = (lng - srcLng) * degLng;
        var north = (lat - srcLat) * degLat;
        var xD = east * sinT + north * cosT;
        var yD = east * cosT - north * sinT;
        var c = gaussianPlume(xD, yD, Q, u, he, stability);
        conc[py * cw + px] = c;
        if (c > maxC) maxC = c;
      }
    }

    var threshold = maxC * 0.001;
    for (var i = 0; i < cw * ch; i++) {
      var val = conc[i];
      if (val < threshold) continue;
      var t = Math.min(val / maxC, 1);
      var r, g, b, a;
      if (t < 0.1) {
        r = 0; g = 0; b = 0.4 + t * 4; a = t * 0.5;
      } else if (t < 0.25) {
        r = 0; g = (t - 0.1) * 6.67; b = 0.8 - (t - 0.1) * 2.67; a = 0.05 + t * 0.3;
      } else if (t < 0.5) {
        r = 0; g = 1; b = 0.4 - (t - 0.25) * 1.6; a = 0.125 + t * 0.3;
      } else if (t < 0.75) {
        r = (t - 0.5) * 4; g = 1 - (t - 0.5) * 2; b = 0; a = 0.275 + t * 0.2;
      } else {
        r = 1; g = 0.5 - (t - 0.75) * 2; b = 0; a = 0.425 + t * 0.15;
      }
      var idx = i * 4;
      data[idx] = Math.round(Math.min(r, 1) * 255);
      data[idx + 1] = Math.round(Math.min(g, 1) * 255);
      data[idx + 2] = Math.round(Math.min(b, 1) * 255);
      data[idx + 3] = Math.round(Math.min(a, 0.85) * 255);
    }

    ctx.putImageData(imgData, 0, 0);

    state.heatmapLayer = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.85 }).addTo(state.map);

    updateCO2Info();
  }

  // ─── Search ───
  function parseCoords(str) {
    var cleaned = str.trim().replace(/\s+/g, ' ').replace(/[°\u2032\u2033']/g, '').replace(/[,\s]+/g, ',');
    var parts = cleaned.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length === 2) {
      var lat = parseFloat(parts[0]);
      var lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat, lng: lng };
    }
    return null;
  }

  function zoomToResult(result) {
    if (result.bounds) {
      state.map.fitBounds(result.bounds, { padding: [40, 40], maxZoom: 16, duration: 1.5 });
    } else {
      var zoom = result.type === 'country' ? 6 : result.type === 'state' ? 8 : result.type === 'city' ? 12 : 14;
      state.map.flyTo([result.lat, result.lng], zoom, { duration: 1.5 });
    }
  }

  var searchDropdown = null;

  function closeSearchDropdown() {
    if (searchDropdown) { searchDropdown.remove(); searchDropdown = null; }
  }

  function showSearchDropdown(results, input) {
    closeSearchDropdown();
    if (!results.length) return;
    var rect = input.getBoundingClientRect();
    var drop = document.createElement('div');
    drop.id = 'search-dropdown';
    drop.style.cssText = 'position:fixed;top:' + (rect.bottom + 2) + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;max-height:260px;overflow-y:auto;background:#1e1e1e;border:1px solid rgba(255,255,255,.12);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:10000;font-size:12px';
    results.forEach(function (r, i) {
      var item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;color:#e8eaed;border-bottom:1px solid rgba(255,255,255,.06);transition:background .15s' + (i === 0 ? ';background:rgba(138,180,248,.12)' : '');
      item.textContent = r.display_name;
      item.addEventListener('mouseenter', function () { item.style.background = 'rgba(138,180,248,.12)'; });
      item.addEventListener('mouseleave', function () { item.style.background = ''; });
      item.addEventListener('click', function () {
        closeSearchDropdown();
        flyToNominatimResult(r, input);
      });
      drop.appendChild(item);
    });
    document.body.appendChild(drop);
    searchDropdown = drop;
  }

  function flyToNominatimResult(r, input) {
    var lat = parseFloat(r.lat);
    var lng = parseFloat(r.lon);
    var bounds = null;
    if (r.boundingbox) {
      bounds = L.latLngBounds(
        L.latLng(parseFloat(r.boundingbox[0]), parseFloat(r.boundingbox[2])),
        L.latLng(parseFloat(r.boundingbox[1]), parseFloat(r.boundingbox[3]))
      );
    }
    var result = { lat: lat, lng: lng, name: r.display_name, bounds: bounds, type: r.type };
    zoomToResult(result);
    input.value = r.display_name.split(',')[0];
    UI.toast('Flew to ' + r.display_name.split(',')[0]);
  }

  function searchPlace(query) {
    var coords = parseCoords(query);
    if (coords) return Promise.resolve([{ lat: coords.lat, lng: coords.lng, name: null, display_name: coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4), type: 'coordinate', bounds: null }]);

    var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=5&addressdetails=0';
    return fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Geocoding request failed');
        return r.json();
      })
      .then(function (data) {
        if (!data.length) return null;
        return data.map(function (r) {
          return {
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            name: r.display_name,
            display_name: r.display_name,
            type: r.type,
            boundingbox: r.boundingbox,
            bounds: r.boundingbox ? L.latLngBounds(
              L.latLng(parseFloat(r.boundingbox[0]), parseFloat(r.boundingbox[2])),
              L.latLng(parseFloat(r.boundingbox[1]), parseFloat(r.boundingbox[3]))
            ) : null,
          };
        });
      });
  }

  function handleSearch() {
    var input = document.getElementById('search-input');
    var query = input.value.trim();
    if (!query) return;

    closeSearchDropdown();
    input.disabled = true;
    searchPlace(query)
      .then(function (results) {
        if (!results || results.length === 0) { UI.toast('No results found for "' + query + '"'); return; }
        if (results.length === 1) {
          var r = results[0];
          zoomToResult(r);
          input.value = r.name.split(',')[0];
          UI.toast('Flew to ' + r.name.split(',')[0]);
        } else {
          showSearchDropdown(results, input);
          UI.toast(results.length + ' results found — select one');
        }
      })
      .catch(function (err) { UI.toast('Search error: ' + err.message); })
      .finally(function () { input.disabled = false; });
  }

  // ─── CO2 Dispersion Model (Gaussian Plume, Pasquill-Gifford) ───
  // Parameters derived from flare volume: 35M MSCF/yr → Q = 60,600 g/s
  // Effective stack height he = 75m (buoyant plume rise, 50-100m range)
  // Ambient wind speed range: 1.7 - 4.0 m/s (mean 2.85 m/s)
  // Stability classes: C (slightly unstable), D (neutral)
  // Peak ground-level impact radius: 1.2 - 2.5 km at mean wind

  var CO2_PARAMS = {
    Q: 60600,
    he: 75,
    maxExtent: 2500,
    windRange: { min: 1.7, max: 4.0 },
    peakRadius: { low: 1.2, high: 2.5 },
  };

  function sigmaY(x, stability) {
    if (stability === 'C') {
      return 0.22 * x / Math.sqrt(1 + 0.0001 * x);
    }
    return 0.16 * x / Math.sqrt(1 + 0.0001 * x);
  }

  function sigmaZ(x, stability) {
    if (stability === 'C') {
      return 0.20 * x;
    }
    return 0.14 * x / Math.sqrt(1 + 0.0003 * x);
  }

  function gaussianPlume(x, y, Q, u, he, stability) {
    if (x <= 1) return 0;
    var sy = sigmaY(x, stability);
    var sz = sigmaZ(x, stability);
    if (sy <= 0.01 || sz <= 0.01) return 0;
    return (Q / (Math.PI * u * sy * sz)) * Math.exp(-(y * y) / (2 * sy * sy)) * Math.exp(-(he * he) / (2 * sz * sz));
  }

  function scheduleHeatmapRender() {
    if (state.co2Timer) clearTimeout(state.co2Timer);
    state.co2Timer = setTimeout(renderHeatmap, 80);
  }

  function updateCO2Info() {
    var co2 = state.co2;
    if (co2.sourceLat == null) {
      document.getElementById('co2-info').innerHTML = '';
      return;
    }
    var u = co2.windSpeed;
    var maxExtent = CO2_PARAMS.maxExtent;
    var downwind = Math.min(maxExtent, maxExtent * (2.5 / Math.max(u, 0.5)));
    var innerRadius = Math.round(downwind * 0.5);

    // Update info panel
    var annualTonne = ((CO2_PARAMS.Q / 1000) * 31536000 / 1000).toFixed(0);
    document.getElementById('co2-info').innerHTML =
      '<span style="color:#8ab4f8">\u25CB</span> ' + innerRadius + 'm &nbsp; <span style="color:#fbbc04">\u25CB</span> ' + downwind + 'm' +
      ' &middot; <span style="color:#9aa0a6">Q</span> ' + (CO2_PARAMS.Q / 1000).toFixed(0) + ' kg/s' +
      ' &middot; <span style="color:#9aa0a6">u</span> ' + u.toFixed(1) + ' m/s' +
      ' &middot; <span style="color:#9aa0a6">' + annualTonne + '</span> t/yr';

    // Update circles on map (always shown when source placed)
    if (co2.circles) { state.map.removeLayer(co2.circles); co2.circles = null; }
    if (co2.sourceLat != null) {
      var circleGroup = L.layerGroup();
      L.circle([co2.sourceLat, co2.sourceLng], { radius: innerRadius, color: '#8ab4f8', fill: false, weight: 1.5, dashArray: '6,4', opacity: 0.5 }).addTo(circleGroup);
      L.circle([co2.sourceLat, co2.sourceLng], { radius: downwind, color: '#fbbc04', fill: false, weight: 1.5, dashArray: '6,4', opacity: 0.6 }).addTo(circleGroup);
      co2.circles = circleGroup.addTo(state.map);
    }
  }

  function placeCO2Source(lat, lng) {
    var co2 = state.co2;
    if (co2.sourceMarker) { state.map.removeLayer(co2.sourceMarker); }
    co2.sourceLat = lat;
    co2.sourceLng = lng;
    co2.sourceMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:20px;height:20px;background:#ff6d01;border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(255,109,1,.7)"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(state.map);
    co2.sourceMarker.bindPopup('<b>Flare Source</b><br>' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '<br>Q = 60,600 g/s');
    document.getElementById('co2-source-status').textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
    updateCO2Info();
    if (state.showHeatmap) scheduleHeatmapRender();
    UI.toast('CO\u2082 source placed');
  }

  function fetchLiveWeather() {
    var co2 = state.co2;
    if (co2.sourceLat == null) return;
    var statusEl = document.getElementById('co2-live-status');
    statusEl.textContent = 'fetching...';
    fetch('/' + prefix + '/weather?lat=' + co2.sourceLat + '&lng=' + co2.sourceLng)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data.wind_speed != null) {
          co2.windSpeed = data.wind_speed;
          document.getElementById('co2-wind-speed').value = data.wind_speed;
          document.getElementById('co2-wind-speed-val').textContent = data.wind_speed.toFixed(1) + ' m/s';
        }
        if (data.wind_deg != null) {
          co2.windDir = data.wind_deg;
          document.getElementById('co2-wind-dir').value = data.wind_deg;
          document.getElementById('co2-wind-dir-val').textContent = data.wind_deg + '\u00b0';
        }
        var parts = [];
        if (data.location) parts.push(data.location);
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

  // ─── Init ───
  function init() {
    try {
      if (typeof L === 'undefined') {
        document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">Error: Leaflet library failed to load</div>';
        return;
      }

      state.map = L.map('map', {
        center: [4.85, 6.2],
        zoom: 9,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(C.tileUrl, {
        attribution: C.tileAttrib,
        maxZoom: 19,
      }).addTo(state.map);

      // Aircraft layer (if enabled)
      if (C.aircraftEnabled) {
        state.acLayer = L.layerGroup().addTo(state.map);
      }

      // Inject aircraft UI if enabled
      if (C.aircraftEnabled) {
        var leftBar = document.querySelector('#top-bar .left');
        var btnAir = document.createElement('button');
        btnAir.className = 'btn active';
        btnAir.id = 'btn-air';
        btnAir.title = 'Aircraft layer';
        btnAir.innerHTML = '<span class="icon">&#9992;</span> Air';
        leftBar.appendChild(btnAir);

        var statsPill = document.getElementById('stats-pill');
        var acStat = document.createElement('div');
        acStat.className = 'stat';
        acStat.innerHTML = '<span class="num" id="s-air">0</span><span>&#9992;</span>';
        var divd = document.createElement('div');
        divd.className = 'divider';
        var sDot = document.createElement('span');
        sDot.className = 'status-dot offline pulse';
        sDot.id = 's-dot';
        var sTxt = document.createElement('span');
        sTxt.id = 'stat-text';
        sTxt.textContent = 'Connecting';
        statsPill.appendChild(acStat);
        statsPill.appendChild(divd);
        statsPill.appendChild(sDot);
        statsPill.appendChild(sTxt);

        var legend = document.getElementById('legend');
        var acLegend = document.createElement('div');
        acLegend.className = 'section';
        acLegend.innerHTML =
          '<h4>&#9992; Aircraft</h4>' +
          '<div class="legend-item"><span class="swatch" style="background:#34a853"></span>0 \u2013 10k ft</div>' +
          '<div class="legend-item"><span class="swatch" style="background:#fbbc04"></span>10 \u2013 30k ft</div>' +
          '<div class="legend-item"><span class="swatch" style="background:#ea4335"></span>30k+ ft</div>' +
          '<div class="legend-item"><span class="swatch" style="background:rgba(255,255,255,.15)"></span>No alt</div>';
        legend.insertBefore(acLegend, legend.firstChild);

        // Aircraft button event
        document.getElementById('btn-air').addEventListener('click', function () {
          state.showAc = !state.showAc;
          this.classList.toggle('active');
          if (state.showAc) { state.map.addLayer(state.acLayer); }
          else { state.map.removeLayer(state.acLayer); }
        });
      }

      // Inject CO2 button
      var rightBar = document.querySelector('#top-bar .right');
      var btnCO2 = document.createElement('button');
      btnCO2.className = 'btn';
      btnCO2.id = 'btn-co2';
      btnCO2.title = 'CO\u2082 dispersion layer';
      btnCO2.innerHTML = '<span class="icon">\u26a0</span> CO\u2082';
      rightBar.insertBefore(btnCO2, document.getElementById('btn-legend'));

      // CO2 panel events
      document.getElementById('btn-co2').addEventListener('click', function () {
        var panel = document.getElementById('co2-panel');
        var isOpen = panel.classList.toggle('open');
        this.classList.toggle('active');
        if (isOpen) {
          if (state.showHeatmap) {
            UI.toast('CO\u2082 controls open');
          } else {
            UI.toast('Enable Heat to see dispersion');
          }
        } else {
          UI.toast('CO\u2082 controls closed');
        }
      });

      document.getElementById('co2-wind-dir').addEventListener('input', function () {
        state.co2.windDir = parseFloat(this.value);
        document.getElementById('co2-wind-dir-val').textContent = this.value + '\u00b0';
        updateCO2Info();
        if (state.showHeatmap) scheduleHeatmapRender();
      });

      document.getElementById('co2-wind-speed').addEventListener('input', function () {
        state.co2.windSpeed = parseFloat(this.value);
        document.getElementById('co2-wind-speed-val').textContent = this.value + ' m/s';
        updateCO2Info();
        if (state.showHeatmap) scheduleHeatmapRender();
      });

      document.querySelectorAll('input[name="co2-stability"]').forEach(function (el) {
        el.addEventListener('change', function () {
          state.co2.stability = this.value;
          if (state.showHeatmap) scheduleHeatmapRender();
        });
      });

      if (C.weatherEnabled) {
        document.getElementById('btn-co2-live').addEventListener('click', function () {
          state.co2.liveWeather = !state.co2.liveWeather;
          this.classList.toggle('active');
          if (state.co2.liveWeather) {
            if (state.co2.sourceLat == null) {
              UI.toast('Place a source first');
              state.co2.liveWeather = false;
              this.classList.remove('active');
              return;
            }
            fetchLiveWeather();
            state.co2.liveTimer = setInterval(fetchLiveWeather, 300000);
            UI.toast('Live weather on');
          } else {
            if (state.co2.liveTimer) { clearInterval(state.co2.liveTimer); state.co2.liveTimer = null; }
            document.getElementById('co2-live-status').textContent = '';
            UI.toast('Live weather off');
          }
        });
      } else {
        document.getElementById('btn-co2-live').style.display = 'none';
      }

      // Map click
      state.map.on('click', function (e) {
        if (state.pinMode && cfg.pinsEnabled) {
          var suggested = 'Pin ' + (state.pins.length + 1);
          var name = prompt('Pin name:', suggested);
          if (name === null) { UI.toast('Pin cancelled'); return; }
          var imageUrl = prompt('Image URL (optional):') || '';
          addPin(e.latlng.lat, e.latlng.lng, name, imageUrl);
        } else if (state.showHeatmap || document.getElementById('co2-panel').classList.contains('open')) {
          placeCO2Source(e.latlng.lat, e.latlng.lng);
        } else {
          if (state.acSelected) { resetColors(); }
          UI.hideInfo();
        }
      });

      // UI event bindings
      document.getElementById('btn-pin').addEventListener('click', function () {
        if (!cfg.pinsEnabled) { UI.toast('Pins are disabled'); return; }
        state.pinMode = !state.pinMode;
        this.classList.toggle('active');
        UI.toast(state.pinMode ? 'Pin mode on \u2014 click the map to drop a pin' : 'Pin mode off');
      });

      document.getElementById('btn-heatmap').addEventListener('click', function () {
        state.showHeatmap = !state.showHeatmap;
        this.classList.toggle('active');
        if (state.showHeatmap) {
          renderHeatmap();
          UI.toast('Heatmap on');
        } else {
          if (state.heatmapLayer) {
            state.map.removeLayer(state.heatmapLayer);
            state.heatmapLayer = null;
          }
          UI.toast('Heatmap off');
        }
      });

      document.getElementById('btn-clear-pins').addEventListener('click', clearAllPins);

      document.getElementById('btn-legend').addEventListener('click', function () {
        document.getElementById('legend').classList.toggle('open');
      });

      document.getElementById('co2-close').addEventListener('click', function () {
        document.getElementById('btn-co2').classList.remove('active');
        document.getElementById('co2-panel').classList.remove('open');
        UI.toast('CO\u2082 panel closed');
      });

      document.getElementById('info-close').addEventListener('click', function () {
        UI.hideInfo();
        if (state.acSelected) { resetColors(); }
      });

      // Close search dropdown on outside click
      document.addEventListener('click', function (e) {
        if (searchDropdown && !e.target.closest('#search-container') && !e.target.closest('#search-dropdown')) {
          closeSearchDropdown();
        }
      });

      // Hotkeys
      document.addEventListener('keydown', function (e) {
        if (e.key === 'r' || e.key === 'R') { state.rotate = !state.rotate; }
        if (e.key === 'Escape') {
          if (searchDropdown) { closeSearchDropdown(); return; }
          if (state.pinMode) {
            state.pinMode = false;
            document.getElementById('btn-pin').classList.remove('active');
            UI.toast('Pin mode off');
            return;
          }
          UI.hideInfo();
          if (state.acSelected) { resetColors(); }
        }
        if (searchDropdown) {
          var items = searchDropdown.querySelectorAll('div');
          var idx = -1;
          items.forEach(function (it, i) { if (it.matches(':hover')) idx = i; });
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = Math.min(idx + 1, items.length - 1);
            items.forEach(function (it) { it.style.background = ''; });
            if (idx >= 0) { items[idx].style.background = 'rgba(138,180,248,.12)'; items[idx].scrollIntoView({ block: 'nearest' }); }
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = idx < 0 ? items.length - 1 : Math.max(idx - 1, 0);
            items.forEach(function (it) { it.style.background = ''; });
            items[idx].style.background = 'rgba(138,180,248,.12)'; items[idx].scrollIntoView({ block: 'nearest' });
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            items.forEach(function (it) {
              if (it.matches(':hover') || it.style.background) {
                it.click();
              }
            });
          }
        }
      });

      // Search
      document.getElementById('btn-search').addEventListener('click', handleSearch);
      document.getElementById('search-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
        if (e.key === 'Escape') { this.value = ''; this.blur(); }
      });

      // Rotate
      setInterval(function () {
        if (state.rotate) {
          state.map.panBy([1, 0], { animate: true, duration: 0.05 });
        }
      }, 50);

      // Start services
      loadPins();
      loadKml();

      if (C.aircraftEnabled && state.acLayer) {
        fetchAc();
        state.acTimer = setInterval(fetchAc, C.acInterval);
      }

    } catch (err) {
      document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">Error: ' + err.message + '<br><pre style="margin-top:10px;font-size:12px;color:#ea4335">' + err.stack + '</pre></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
