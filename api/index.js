const { createApp } = require('../server');

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp().catch(err => {
      console.error('WorldView init failed:', err);
      throw err;
    });
  }
  return appPromise;
}

module.exports = function handler(req, res) {
  getApp().then(
    app => app(req, res),
    err => {
      console.error('WorldView request failed:', err);
      if (!res.headersSent) {
        res.status(500).send('WorldView failed to initialize');
      }
    }
  );
};
