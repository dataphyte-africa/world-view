const { json } = require('../src/pages-lib');

module.exports.onRequestGet = async function ({ request, env }) {
  const apiKey = env.WORLDVIEW_OWM_KEY;
  if (!apiKey) {
    return json(503, { error: 'OpenWeather API key not configured' });
  }

  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  if (lat == null || lng == null) {
    return json(400, { error: 'lat and lng required' });
  }

  const api = new URL('https://api.openweathermap.org/data/2.5/weather');
  api.searchParams.set('lat', lat);
  api.searchParams.set('lon', lng);
  api.searchParams.set('appid', apiKey);
  api.searchParams.set('units', 'metric');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(api, { signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const wind = data.wind || {};

    return json(200, {
      wind_speed: wind.speed != null ? wind.speed : null,
      wind_deg: wind.deg != null ? wind.deg : null,
      gust: wind.gust != null ? wind.gust : null,
      location: data.name || null,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    return json(502, { error: 'Weather fetch failed: ' + err.message });
  } finally {
    clearTimeout(timer);
  }
};
