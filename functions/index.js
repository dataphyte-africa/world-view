const { getConfig, renderIndex } = require('../src/pages-lib');

module.exports.onRequestGet = function ({ env }) {
  const html = renderIndex(getConfig(env));
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};
