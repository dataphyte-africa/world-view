'use strict';

import { state } from './config.js';
import { UI } from './ui.js';

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

export var searchDropdown = null;

export function closeSearchDropdown() {
  if (searchDropdown) { searchDropdown.remove(); searchDropdown = null; }
}

function showSearchDropdown(results, input) {
  closeSearchDropdown();
  if (!results.length) return;
  var rect = input.getBoundingClientRect();
  var drop = document.createElement('div');
  drop.id = 'search-dropdown';
  drop.style.top = (rect.bottom + 2) + 'px';
  drop.style.left = rect.left + 'px';
  drop.style.width = rect.width + 'px';
  results.forEach(function (r, i) {
    var item = document.createElement('div');
    item.className = 'search-item' + (i === 0 ? ' selected' : '');
    item.textContent = r.display_name;
    item.addEventListener('mouseenter', function () { selectSearchItem(item); });
    item.addEventListener('click', function () {
      closeSearchDropdown();
      flyToNominatimResult(r, input);
    });
    drop.appendChild(item);
  });
  document.body.appendChild(drop);
  searchDropdown = drop;
}

export function selectSearchItem(item) {
  if (!item) return;
  var items = searchDropdown.querySelectorAll('.search-item');
  items.forEach(function (it) { it.classList.remove('selected'); });
  item.classList.add('selected');
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

export function handleSearch() {
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
