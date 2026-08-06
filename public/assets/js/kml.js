'use strict';

import { cfg, state, escapeHtml } from './config.js';

function makeKmlIcon(highlight) {
  return L.divIcon({
    className: 'kml-marker',
    html: '<div class="kml-icon' + (highlight ? ' highlight' : '') + '"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function loadKml() {
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
