'use strict';

import { state } from './config.js';

export var UI = {
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
