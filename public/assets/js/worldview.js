'use strict';

import { cfg, C, state, on } from './config.js';
import { UI } from './ui.js';
import { loadPins, clearAllPins, openPinModal, closePinModal, confirmPinModal, removePin, retryPin, flyToPin, updatePinList } from './pins.js';
import { loadKml } from './kml.js';
import { loadCO2Sources, flyToCO2, startLiveWeather, stopLiveWeather, updateCO2Info, closeCO2Detail } from './co2.js';
import { renderHeatmap, scheduleHeatmapRender } from './heatmap.js';

// ─── Init ───
function init() {
  try {
    if (typeof L === 'undefined') {
      document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">Error: Leaflet library failed to load</div>';
      return;
    }

    // Frame centered on Ogboinbiri community (~4.8266, 5.9661), keeping both CO2 flare sources in view
    var frame = L.latLngBounds([4.8190, 5.9619], [4.8342, 5.9703]);

    state.map = L.map('map', {
      center: frame.getCenter(),
      zoom: 16,
      maxBounds: frame,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
      zoomSnap: 0.25,
      dragging: false,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    // Pins subscription: re-render list + stats whenever state.pins changes
    on('pins', function () {
      updatePinList();
      UI.updateStats();
    });

    L.tileLayer(C.tileUrl, {
      attribution: C.tileAttrib,
      maxZoom: 19,
    }).addTo(state.map);

    // Frame the viewport to the locked box and forbid zooming out past it
    state.map.fitBounds(frame);
    state.map.setMinZoom(state.map.getBoundsZoom(frame));

    // CO2 panel events

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
      UI.hideInfo();
      closeCO2Detail();
    });

    // Pin creation modal
    document.getElementById('pin-modal-save').addEventListener('click', confirmPinModal);
    document.getElementById('pin-modal-cancel').addEventListener('click', closePinModal);
    document.getElementById('pin-modal-close').addEventListener('click', closePinModal);
    document.querySelector('[data-pin-modal-dismiss]').addEventListener('click', closePinModal);
    document.getElementById('pin-modal-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); confirmPinModal(); }
      if (e.key === 'Escape') { e.stopPropagation(); closePinModal(); }
    });

    // Delegated pin-list listener (buttons carry data-action)
    document.getElementById('pin-list').addEventListener('click', function (e) {
      var item = e.target.closest('.pin-item');
      if (!item) return;
      var btn = e.target.closest('button');
      if (btn && btn.dataset.action === 'delete') { removePin(item.dataset.id); return; }
      if (btn && btn.dataset.action === 'retry') { retryPin(item.dataset.id); return; }
      flyToPin(item.dataset.id);
    });

    // Delegated co2-list listener (click card to fly to flare)
    document.getElementById('co2-list').addEventListener('click', function (e) {
      var item = e.target.closest('.co2-item');
      if (!item) return;
      flyToCO2(parseInt(item.dataset.id, 10));
    });

    document.getElementById('btn-heatmap').classList.add('active');

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

    document.getElementById('co2-close').addEventListener('click', function () {
      var btn = document.getElementById('btn-co2');
      if (btn) btn.classList.remove('active');
      document.getElementById('co2-panel').classList.remove('open');
      UI.toast('CO\u2082 panel closed');
    });

    document.getElementById('info-close').addEventListener('click', function () {
      UI.hideInfo();
    });

    // Hotkeys
    document.addEventListener('keydown', function (e) {
      if (e.key === 'r' || e.key === 'R') { state.rotate = !state.rotate; }
      if (e.key === 'Escape') {
        if (document.getElementById('pin-modal').classList.contains('open')) { closePinModal(); return; }
        if (state.pinMode) {
          state.pinMode = false;
          UI.toast('Pin mode off');
          return;
        }
        UI.hideInfo();
      }
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
    loadCO2Sources();

  } catch (err) {
    document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif">Error: ' + err.message + '<br><pre style="margin-top:10px;font-size:12px;color:#ea4335">' + err.stack + '</pre></div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
