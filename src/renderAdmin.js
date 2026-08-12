function renderAdmin(config) {
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WorldView &middot; Manage Cards</title>
<link href="/assets/css/worldview.css" rel="stylesheet">
</head>
<body class="admin-page">
<div class="admin-shell">
  <header class="admin-header">
    <div>
      <h1>WorldView</h1>
      <p>Add and edit card information &middot; operators, locations, descriptions, image links</p>
    </div>
    <a class="btn admin-map-link" href="/${config.routePrefix}">&#128506; Open Map</a>
  </header>

  <div class="admin-layout">
    <section class="admin-cards" aria-label="Cards">
      <div class="admin-section-head">
        <h2>Cards <span id="card-count" class="pin-count"></span></h2>
        <button id="btn-new-card" class="btn admin-new-btn" type="button">+ New card</button>
      </div>
      <div id="card-list" class="card-list"></div>
    </section>

    <section class="admin-form-wrap" aria-label="Card information">
      <form id="card-form" class="admin-form">
        <div class="admin-section-head">
          <h2 id="form-title">New card</h2>
        </div>

        <div class="modal-field">
          <label class="modal-label" for="f-lat">Latitude</label>
          <input id="f-lat" class="modal-input" type="number" step="any" min="-90" max="90" placeholder="e.g. 4.826555" required autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="modal-label" for="f-lng">Longitude</label>
          <input id="f-lng" class="modal-input" type="number" step="any" min="-180" max="180" placeholder="e.g. 5.968766" required autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="modal-label" for="f-operator">Operator</label>
          <input id="f-operator" class="modal-input" type="text" maxlength="255" placeholder="e.g. NNPC Ltd" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="modal-label" for="f-location">Location</label>
          <input id="f-location" class="modal-input" type="text" maxlength="255" placeholder="e.g. Ogboinbiri, Bayelsa" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="modal-label" for="f-description">Description</label>
          <textarea id="f-description" class="modal-input admin-textarea" maxlength="4000" rows="4" placeholder="Describe the flare source..."></textarea>
        </div>
        <div class="modal-field">
          <label class="modal-label" for="f-image">Image URL <span class="modal-optional">(link)</span></label>
          <input id="f-image" class="modal-input" type="text" maxlength="2000" placeholder="https://..." autocomplete="off">
          <div id="f-image-preview" class="admin-image-preview"></div>
        </div>

        <div class="admin-form-actions">
          <span id="form-status" class="admin-status" role="status"></span>
          <button id="btn-save" class="btn modal-save" type="submit">Save card</button>
        </div>
      </form>
    </section>
  </div>
</div>

<script type="application/json" id="admin-config">${safeConfig}</script>
<script type="module" src="/assets/js/manage.js"></script>
</body>
</html>`;
}

module.exports = { renderAdmin };
