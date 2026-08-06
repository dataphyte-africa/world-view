'use strict';

import { state } from './config.js';
import { UI } from './ui.js';
import { CO2_PARAMS, gaussianPlume, pollutionRadiusMeters } from './co2-model.js';
import { co2Centroid, updateCO2Info } from './co2.js';

// ─── Heatmap (CO2 Dispersion) ───
// The heatmap renders the Gaussian plume concentration from the CO2 dispersion model.
// Toggle with the "Heat" button; adjust parameters via the "CO2" panel.

export function renderHeatmap() {
  if (state.heatmapTimer) clearTimeout(state.heatmapTimer);
  state.heatmapTimer = setTimeout(doRenderHeatmap, 80);
}

function doRenderHeatmap() {
  if (state.heatmapLayer) { state.map.removeLayer(state.heatmapLayer); state.heatmapLayer = null; }
  if (!state.showHeatmap) return;

  var sources = state.co2.sources;
  if (!sources.length) {
    UI.toast('No CO\u2082 sources');
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

export function scheduleHeatmapRender() {
  if (state.co2Timer) clearTimeout(state.co2Timer);
  state.co2Timer = setTimeout(renderHeatmap, 80);
}
