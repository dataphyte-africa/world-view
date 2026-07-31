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
    },
    weatherEnabled: !!cfg.weatherEnabled,
    weatherInterval: cfg.weatherInterval || 60000,
  };

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

  var apiUrl = function (path) { return C.api.pins + path; };

  // ─── Icons ───
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

    updateStats: function () {
      document.getElementById('b-total').textContent = state.pins.length;
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

    var sources = state.co2.sources;
    if (!sources.length) {
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
    var pollutionRadius = pollutionRadiusMeters(u);

    // Per-source data (own meters-per-degree longitude) and union bounding box
    var srcData = sources.map(function (s) {
      return {
        lat: s.lat,
        lng: s.lng,
        degLng: 111320 * Math.cos(s.lat * Math.PI / 180),
      };
    });
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    srcData.forEach(function (s) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lng < minLng) minLng = s.lng;
      if (s.lng > maxLng) maxLng = s.lng;
    });
    var centroid = co2Centroid();
    var padLat = pollutionRadius / degLat;
    var padLng = pollutionRadius / (111320 * Math.cos(centroid.lat * Math.PI / 180));
    var bounds = L.latLngBounds(
      L.latLng(minLat - padLat, minLng - padLng),
      L.latLng(maxLat + padLat, maxLng + padLng)
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
        var total = 0;
        for (var si = 0; si < srcData.length; si++) {
          var s = srcData[si];
          var east = (lng - s.lng) * s.degLng;
          var north = (lat - s.lat) * degLat;
          if (east * east + north * north > pollutionRadius * pollutionRadius) continue;
          var xD = east * sinT + north * cosT;
          var yD = east * cosT - north * sinT;
          total += gaussianPlume(xD, yD, Q, u, he, stability);
        }
        conc[py * cw + px] = total;
        if (total > maxC) maxC = total;
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
  // CO2 Atmospheric Dispersion Report (guide):
  //   Q = 60,600 g/s for 35 MMSCF/yr flared gas (54.6 kg CO2/MSCF).
  //   Ambient wind range 1.7 - 4.0 m/s (mean 2.85 m/s).
  //   Pasquill Stability Class C (slightly unstable) / D (neutral).
  //   Effective stack height he scales 50-100 m (modelled 75 m).
  //   Peak ground-level impact radius (downwind reach before ambient blend):
  //     1.7 m/s  -> 1.5 - 3.5 km
  //     4.0 m/s  -> 0.8 - 2.0 km
  //     2.85 m/s -> 1.2 - 2.5 km
  //   Summary: effective dispersion radius stabilizes between 1.2 km and 2.5 km.

  var CO2_PARAMS = {
    Q: 60600,
    he: 75,
    maxExtent: 2500,
    windRange: { min: 1.7, max: 4.0 },
    peakRadius: { low: 1.2, high: 2.5 },
    spread: 1.5,
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
    // Widen lateral spread so the plume footprint is roughly as wide as the
    // affected community (dispersion radius) rather than a narrow streak.
    var sy = sigmaY(x, stability) * CO2_PARAMS.spread;
    var sz = sigmaZ(x, stability);
    if (sy <= 0.01 || sz <= 0.01) return 0;
    return (Q / (Math.PI * u * sy * sz)) * Math.exp(-(y * y) / (2 * sy * sy)) * Math.exp(-(he * he) / (2 * sz * sz));
  }

  // Approximate community impact radius (peak ground-level dispersion radius
  // from the guide): 2.5 km at low wind, shrinking linearly to 1.2 km at high
  // wind. Matches the summary finding (1.2 - 2.5 km).
  function pollutionRadiusMeters(u) {
    var peak = CO2_PARAMS.peakRadius;
    var wMin = CO2_PARAMS.windRange.min;
    var wMax = CO2_PARAMS.windRange.max;
    var uc = Math.min(Math.max(u, wMin), wMax);
    var t = (uc - wMin) / (wMax - wMin);
    return (peak.high - (peak.high - peak.low) * t) * 1000;
  }

  function scheduleHeatmapRender() {
    if (state.co2Timer) clearTimeout(state.co2Timer);
    state.co2Timer = setTimeout(renderHeatmap, 80);
  }

  function co2Centroid() {
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

  function updateCO2Info() {
    var co2 = state.co2;
    var sources = co2.sources;
    if (!sources.length) {
      document.getElementById('co2-info').innerHTML = '';
      document.getElementById('co2-source-status').textContent = 'Click map to place';
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

  function placeCO2Source(lat, lng) {
    var co2 = state.co2;
    var id = co2.nextId++;
    var marker = L.marker([lat, lng], { icon: co2MarkerIcon() }).addTo(state.map);
    marker.bindPopup(
      '<b>Flare Source #' + id + '</b><br>' + lat.toFixed(4) + ', ' + lng.toFixed(4) +
      '<br>Q = 60,600 g/s' +
      '<br><button class="co2-remove" data-id="' + id + '">Remove source</button>'
    );
    marker.on('popupopen', function (e) {
      var btn = e.popup.getElement().querySelector('.co2-remove');
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          removeCO2Source(id);
          state.map.closePopup();
        });
      }
    });
    co2.sources.push({ id: id, lat: lat, lng: lng, marker: marker, arrow: null });
    updateCO2Info();
    if (state.showHeatmap) scheduleHeatmapRender();
    startLiveWeather();
    UI.toast('CO\u2082 source placed');
  }

  function removeCO2Source(id) {
    var co2 = state.co2;
    var idx = -1;
    for (var i = 0; i < co2.sources.length; i++) {
      if (co2.sources[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;
    var s = co2.sources[idx];
    if (s.marker) state.map.removeLayer(s.marker);
    if (s.arrow) state.map.removeLayer(s.arrow);
    co2.sources.splice(idx, 1);
    updateCO2Info();
    if (state.showHeatmap) scheduleHeatmapRender();
    if (!co2.sources.length) stopLiveWeather();
    UI.toast('Source removed');
  }

  function startLiveWeather() {
    if (!C.weatherEnabled || state.co2.liveWeather) return;
    state.co2.liveWeather = true;
    var btn = document.getElementById('btn-co2-live');
    if (btn) btn.classList.add('active');
    fetchLiveWeather();
    state.co2.liveTimer = setInterval(fetchLiveWeather, C.weatherInterval);
  }

  function stopLiveWeather() {
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
    fetch('/' + prefix + '/weather?lat=' + c.lat + '&lng=' + c.lng, { signal: AbortSignal.timeout(15000) })
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
          if (!state.co2.liveWeather) {
            if (!state.co2.sources.length) {
              UI.toast('Place a source first');
              return;
            }
            startLiveWeather();
            UI.toast('Live weather on');
          } else {
            stopLiveWeather();
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

    } catch (err) {
      document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">Error: ' + err.message + '<br><pre style="margin-top:10px;font-size:12px;color:#ea4335">' + err.stack + '</pre></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
