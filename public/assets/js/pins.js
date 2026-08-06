'use strict';

import { cfg, state, apiUrl, escapeHtml, commit } from './config.js';
import { UI } from './ui.js';

function findPin(id) {
  return state.pins.find(function (p) { return String(p.id) === String(id); });
}

// ─── Pin API ───
export function loadPins() {
  if (!cfg.pinsEnabled) return;
  fetch(apiUrl(''))
    .then(function (r) { return r.json(); })
    .then(function (pins) {
      var next = pins.map(function (p) {
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          name: p.name,
          imageUrl: p.imageUrl || '',
          createdAt: p.createdAt,
        };
      });
      commit('pins', next);
      next.forEach(createPinMarker);
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

  var popupHtml = '<b>' + escapeHtml(pin.name) + '</b><br>' + pin.lat.toFixed(4) + ', ' + pin.lng.toFixed(4);
  if (pin.imageUrl) {
    popupHtml += '<div class="pin-img-preview"><img src="' + escapeHtml(pin.imageUrl) + '" alt="' + escapeHtml(pin.name) + '" onerror="this.parentElement.innerHTML=\'<span style=display:block;padding:6px;font-size:11px;color:#9aa0a6>Image failed to load</span>\'"></div>';
  }
  marker.bindPopup(popupHtml);
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

function applySavedPin(pin, saved) {
  var tempId = pin.id;
  pin.id = saved.id;
  pin.saveError = false;
  var marker = state.pinMarkers[tempId];
  if (marker) {
    marker.pinId = saved.id;
    state.pinMarkers[saved.id] = marker;
    delete state.pinMarkers[tempId];
  }
}

function addPin(lat, lng, name, imageUrl) {
  name = (name || '').trim() || ('Pin ' + (state.pins.length + 1));
  var pin = {
    id: crypto.randomUUID(),
    lat: lat,
    lng: lng,
    name: name,
    imageUrl: imageUrl || '',
    createdAt: Date.now(),
    saveError: false,
  };

  createPinMarker(pin);
  state.pins.push(pin);
  commit('pins', state.pins);
  UI.toast('Pinned ' + name);

  savePin(pin).then(function (saved) {
    applySavedPin(pin, saved);
    commit('pins', state.pins);
  }).catch(function () {
    pin.saveError = true;
    commit('pins', state.pins);
    UI.toast('Failed to save pin \u2014 click \u21bb to retry');
  });
}

export function removePin(id) {
  var pin = findPin(id);
  if (!pin) return;

  if (pin.id && typeof pin.id === 'number') {
    deletePinApi(pin.id).catch(function () { UI.toast('Failed to delete pin from server'); });
  }

  var next = state.pins.filter(function (p) { return String(p.id) !== String(id); });
  if (state.pinMarkers[id]) {
    state.map.removeLayer(state.pinMarkers[id]);
    delete state.pinMarkers[id];
  }
  commit('pins', next);
}

export function retryPin(id) {
  var pin = findPin(id);
  if (!pin) return;
  savePin(pin).then(function (saved) {
    applySavedPin(pin, saved);
    commit('pins', state.pins);
    UI.toast('Pin saved');
  }).catch(function () {
    pin.saveError = true;
    commit('pins', state.pins);
    UI.toast('Still failed to save pin');
  });
}

export function flyToPin(id) {
  var pin = findPin(id);
  if (!pin) return;
  state.map.flyTo([pin.lat, pin.lng], 13, { duration: 1.5 });
}

export function clearAllPins() {
  state.pins.forEach(function (p) {
    if (p.id && typeof p.id === 'number') {
      deletePinApi(p.id).catch(function () {});
    }
  });
  for (var id in state.pinMarkers) {
    if (state.pinMarkers.hasOwnProperty(id)) state.map.removeLayer(state.pinMarkers[id]);
  }
  state.pinMarkers = {};
  commit('pins', []);
  UI.toast('All pins cleared');
}

// ─── Pin creation modal ───
export function openPinModal(latlng) {
  state.pendingPin = latlng;
  document.getElementById('pin-modal-coords').textContent =
    latlng.lat.toFixed(4) + ', ' + latlng.lng.toFixed(4);
  var nameInput = document.getElementById('pin-modal-name');
  nameInput.value = 'Pin ' + (state.pins.length + 1);
  document.getElementById('pin-modal-image').value = '';
  document.getElementById('pin-modal').classList.add('open');
  nameInput.focus();
  nameInput.select();
}

export function closePinModal() {
  state.pendingPin = null;
  document.getElementById('pin-modal').classList.remove('open');
}

export function confirmPinModal() {
  if (!state.pendingPin) return;
  var latlng = state.pendingPin;
  var name = document.getElementById('pin-modal-name').value;
  var imageUrl = document.getElementById('pin-modal-image').value.trim();
  closePinModal();
  addPin(latlng.lat, latlng.lng, name, imageUrl);
}

function updatePinList() {
  var list = document.getElementById('pin-list');
  var count = document.getElementById('pin-count');
  count.textContent = '(' + state.pins.length + ')';
  if (state.pins.length === 0) {
    list.innerHTML = '<div class="pin-empty">No pins yet</div>';
    return;
  }
  list.innerHTML = state.pins.map(function (p) {
    var id = escapeHtml(String(p.id));
    return '<div class="pin-item' + (p.saveError ? ' save-error' : '') + '" data-id="' + id + '">' +
      '<span class="pin-dot"></span>' +
      '<span class="pin-img-icon' + (p.imageUrl ? ' has-img' : '') + '" title="' + (p.imageUrl ? 'Has image' : 'No image') + '">' + (p.imageUrl ? '\uD83D\uDDBC' : '') + '</span>' +
      '<span class="pin-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="pin-coords">' + p.lat.toFixed(2) + ', ' + p.lng.toFixed(2) + '</span>' +
      (p.saveError ? '<button class="pin-retry" data-action="retry" data-id="' + id + '" title="Save failed \u2014 retry">&#8635;</button>' : '') +
      '<button class="pin-del" data-action="delete" data-id="' + id + '" title="Remove pin">&times;</button>' +
      '</div>';
  }).join('');
}

export { updatePinList };
