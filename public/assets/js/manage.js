'use strict';

var cfg = {};
try {
  var cfgEl = document.getElementById('admin-config');
  cfg = (cfgEl && JSON.parse(cfgEl.textContent)) || {};
} catch (e) {
  cfg = {};
}

var prefix = cfg.routePrefix != null ? cfg.routePrefix : '';
var api = function (p) { return prefix ? '/' + prefix + p : p; };

var state = {
  cards: [],
  editId: null,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}

function setStatus(msg, ok) {
  var el = document.getElementById('form-status');
  el.textContent = msg;
  el.className = 'admin-status' + (ok === false ? ' error' : ok === true ? ' ok' : '');
  if (msg) {
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(function () { el.textContent = ''; }, 4000);
  }
}

function renderList() {
  var list = document.getElementById('card-list');
  var count = document.getElementById('card-count');
  count.textContent = '(' + state.cards.length + ')';
  if (!state.cards.length) {
    list.innerHTML = '<div class="pin-empty">No cards yet &mdash; create one with the form.</div>';
    return;
  }
  list.innerHTML = state.cards.map(function (c) {
    var img = c.imageUrl
      ? '<div class="admin-card-thumb"><img src="' + escapeHtml(c.imageUrl) + '" alt="" onerror="this.parentElement.innerHTML=\'<span class=admin-thumb-fallback>Image failed</span>\'"></div>'
      : '';
    var op = c.operator || '<span class="admin-muted">No operator</span>';
    var loc = c.location || '<span class="admin-muted">No location</span>';
    var desc = c.description
      ? '<p class="admin-card-desc">' + escapeHtml(c.description) + '</p>'
      : '<p class="admin-card-desc admin-muted">No description</p>';
    return '<div class="admin-card" data-id="' + c.id + '">' +
      img +
      '<div class="admin-card-main">' +
        '<div class="admin-card-title">Card #' + c.id + '</div>' +
        '<div class="admin-card-line"><span class="admin-field-name">Operator</span> ' + op + '</div>' +
        '<div class="admin-card-line"><span class="admin-field-name">Location</span> ' + loc + '</div>' +
        '<div class="admin-card-line"><span class="admin-field-name">Coords</span> <span class="admin-mono">' + c.lat.toFixed(4) + ', ' + c.lng.toFixed(4) + '</span></div>' +
        desc +
      '</div>' +
      '<div class="admin-card-actions">' +
        '<button type="button" class="btn admin-edit-btn" data-action="edit">Edit</button>' +
        '<button type="button" class="btn admin-del-btn" data-action="delete" title="Delete this card">&times;</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function fillForm(c) {
  document.getElementById('f-lat').value = c.lat;
  document.getElementById('f-lng').value = c.lng;
  document.getElementById('f-operator').value = c.operator || '';
  document.getElementById('f-location').value = c.location || '';
  document.getElementById('f-description').value = c.description || '';
  document.getElementById('f-image').value = c.imageUrl || '';
  updatePreview();
  document.getElementById('form-title').textContent = 'Edit card #' + c.id;
}

function resetForm() {
  state.editId = null;
  var form = document.getElementById('card-form');
  form.reset();
  document.getElementById('form-title').textContent = 'New card';
  document.getElementById('f-image-preview').innerHTML = '';
}

function updatePreview() {
  var wrap = document.getElementById('f-image-preview');
  var url = document.getElementById('f-image').value.trim();
  if (!url) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<div class="admin-card-thumb admin-preview"><img src="' + escapeHtml(url) + '" alt="" onerror="this.parentElement.innerHTML=\'<span class=admin-thumb-fallback>Image failed to load</span>\'"></div>';
}

function saveCard(e) {
  e.preventDefault();
  var lat = Number(document.getElementById('f-lat').value);
  var lng = Number(document.getElementById('f-lng').value);
  var operator = document.getElementById('f-operator').value.trim();
  var location = document.getElementById('f-location').value.trim();
  var description = document.getElementById('f-description').value.trim();
  var imageUrl = document.getElementById('f-image').value.trim();

  if (isNaN(lat) || lat < -90 || lat > 90) { setStatus('Enter a valid latitude (-90 to 90)', false); return; }
  if (isNaN(lng) || lng < -180 || lng > 180) { setStatus('Enter a valid longitude (-180 to 180)', false); return; }

  var payload = { lat: lat, lng: lng, operator: operator, location: location, description: description, imageUrl: imageUrl };
  var method = 'POST';
  var url = api('/co2');
  if (state.editId != null) {
    method = 'PUT';
    url = api('/co2/' + state.editId);
  }

  setStatus('Saving...');
  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function (r) {
    if (!r.ok) {
      return r.json().then(function (b) { throw new Error((b && b.error) || ('HTTP ' + r.status)); });
    }
    return r.json();
  }).then(function (saved) {
    state.editId = null;
    loadCards();
    setStatus(state.cards.length ? 'Card #' + saved.id + ' saved' : 'Card saved', true);
    resetForm();
  }).catch(function (err) {
    setStatus(err.message || 'Failed to save card', false);
  });
}

function loadCards() {
  fetch(api('/co2'), { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (list) {
      if (!Array.isArray(list)) return;
      state.cards = list;
      renderList();
    })
    .catch(function () { setStatus('Failed to load cards', false); });
}

function deleteCard(card, cardEl) {
  if (!window.confirm('Delete card #' + card.id + ' (' + (card.operator || 'no operator') + ')?')) return;
  setStatus('Deleting...');
  fetch(api('/co2/' + card.id), { method: 'DELETE', headers: { 'Accept': 'application/json' } })
    .then(function (r) {
      if (!r.ok) {
        return r.json().then(function (b) { throw new Error((b && b.error) || ('HTTP ' + r.status)); });
      }
      return r.json();
    })
    .then(function () {
      if (state.editId === card.id) resetForm();
      loadCards();
      setStatus('Card #' + card.id + ' deleted', true);
    })
    .catch(function (err) {
      setStatus(err.message || 'Failed to delete card', false);
    });
}

function init() {
  document.getElementById('card-form').addEventListener('submit', saveCard);
  document.getElementById('btn-new-card').addEventListener('click', resetForm);
  document.getElementById('f-image').addEventListener('input', updatePreview);

  document.getElementById('card-list').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var cardEl = btn.closest('.admin-card');
    var card = state.cards.find(function (c) { return String(c.id) === cardEl.dataset.id; });
    if (!card) return;
    if (btn.dataset.action === 'delete') { deleteCard(card, cardEl); return; }
    state.editId = card.id;
    fillForm(card);
    document.getElementById('card-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  loadCards();
}

document.addEventListener('DOMContentLoaded', init);
