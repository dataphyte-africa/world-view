const { renderIndex } = require('./renderIndex');

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getConfig(env) {
  return {
    pinsEnabled: true,
    kmlFeatures: [],
    kmlBounds: null,
    pins: [],
    routePrefix: '',
    weatherEnabled: !!env.WORLDVIEW_OWM_KEY,
    weatherInterval: parseInt(env.WORLDVIEW_WEATHER_INTERVAL || '60000', 10),
    assetUrl: '/assets',
  };
}

module.exports = { json, getConfig, renderIndex };
