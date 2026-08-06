function renderIndex(config) {
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WorldView</title>
<link href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" rel="stylesheet">
<link href="/assets/css/worldview.css" rel="stylesheet">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
</script>
</head>
<body>
<div id="map"></div>

<div id="ui-overlay">
  <div id="top-bar">
    <div class="right">
      <button class="btn" id="btn-heatmap" title="Toggle heatmap layer"><span class="icon">&#128293;</span> Heat</button>
    </div>
  </div>

  <div id="legend" class="open">
    <div class="section" id="pin-section">
      <h4 class="legend-header">
        <span>&#128204; Pins <span id="pin-count" class="pin-count"></span></span>
        <button id="btn-clear-pins" class="legend-clear">Clear</button>
      </h4>
      <div id="pin-list"></div>
    </div>
    <div class="section" id="co2-section">
      <h4 class="legend-header">
        <span>&#128293; CO&#8322; Flares <span id="co2-count" class="pin-count"></span></span>
      </h4>
      <div id="co2-list"></div>
    </div>
  </div>

  <div id="co2-panel">
    <div class="co2-header">
      <span class="co2-title">CO&#8322; Dispersion</span>
      <button id="co2-close" class="panel-close" title="Close">&times;</button>
    </div>
    <div class="co2-body">
      <div class="co2-field">
        <span class="co2-label">Source</span>
        <span id="co2-source-status" class="co2-source-status">From database</span>
      </div>
      <div class="co2-field">
        <span class="co2-label">Wind Dir</span>
        <div class="co2-slider-row">
          <input type="range" id="co2-wind-dir" min="0" max="360" value="180" step="1">
          <span id="co2-wind-dir-val" class="co2-val">180&deg;</span>
        </div>
      </div>
      <div class="co2-field">
        <span class="co2-label">Wind Speed (1.7 – 4.0 m/s)</span>
        <div class="co2-slider-row">
          <input type="range" id="co2-wind-speed" min="1.7" max="4.0" value="2.85" step="0.05">
          <span id="co2-wind-speed-val" class="co2-val">2.85 m/s</span>
        </div>
      </div>
      <div class="co2-field">
        <span class="co2-label">Stability (Pasquill)</span>
        <div class="co2-radio-row">
          <label><input type="radio" name="co2-stability" value="C" checked> C (Slightly Unstable)</label>
          <label><input type="radio" name="co2-stability" value="D"> D (Neutral)</label>
        </div>
      </div>
      <div class="co2-field">
        <div class="co2-live-row">
          <button id="btn-co2-live" class="co2-live-btn" title="Fetch live wind data from OpenWeather">&#9992; Live</button>
          <span id="co2-live-status" class="co2-live-status"></span>
        </div>
      </div>
      <div class="co2-info" id="co2-info"></div>
    </div>
  </div>

  <div id="info-panel">
    <button class="close" id="info-close">&times;</button>
    <div class="title" id="info-title">-- <span class="tag" id="info-tag"></span></div>
    <div class="grid" id="info-grid"></div>
  </div>

  <div id="bottom-bar">
    <div class="item" id="b-coords"><span class="val">--</span></div>
    <div class="sep"></div>
    <div class="item">Updated <span class="val" id="b-time">--</span></div>
    <div class="sep"></div>
    <div class="item">All <span class="val" id="b-total">0</span></div>
  </div>
</div>

<div id="toast"></div>

<div id="pin-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
  <div class="modal-backdrop" data-pin-modal-dismiss></div>
  <div class="modal-card">
    <div class="modal-header">
      <span id="pin-modal-title" class="modal-title">New Pin</span>
      <button id="pin-modal-close" class="panel-close" title="Cancel">&times;</button>
    </div>
    <div class="modal-body">
      <div class="modal-field">
        <span class="modal-label">Coordinates</span>
        <span id="pin-modal-coords" class="modal-coords">--</span>
      </div>
      <div class="modal-field">
        <label class="modal-label" for="pin-modal-name">Name</label>
        <input id="pin-modal-name" class="modal-input" type="text" placeholder="Pin name" maxlength="255" autocomplete="off" spellcheck="false">
      </div>
      <div class="modal-field">
        <label class="modal-label" for="pin-modal-image">Image URL <span class="modal-optional">(optional)</span></label>
        <input id="pin-modal-image" class="modal-input" type="text" placeholder="https://..." maxlength="2000" autocomplete="off" spellcheck="false">
      </div>
    </div>
    <div class="modal-footer">
      <button id="pin-modal-cancel" class="btn">Cancel</button>
      <button id="pin-modal-save" class="btn modal-save">Save Pin</button>
    </div>
  </div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script type="application/json" id="worldview-config">${safeConfig}</script>
<script type="module" src="/assets/js/worldview.js"></script>
</body>
</html>`;
}

module.exports = { renderIndex };
