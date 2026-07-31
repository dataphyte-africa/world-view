const { json } = require('../src/pages-lib');

module.exports.onRequestGet = function () {
  return json(200, {
    status: 'ok',
    timestamp: Math.floor(Date.now() / 1000),
    version: '1.0.0',
  });
};
