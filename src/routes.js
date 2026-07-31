const express = require('express');
const axios = require('axios');

function createRoutes(pinService, kmlParser, prefix) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.redirect('/' + prefix);
  });

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    });
  });

  router.get('/weather', async (req, res) => {
    const apiKey = process.env.WORLDVIEW_OWM_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'OpenWeather API key not configured' });
    }

    const { lat, lng } = req.query;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (
      Number.isNaN(latNum) || Number.isNaN(lngNum) ||
      latNum < -90 || latNum > 90 ||
      lngNum < -180 || lngNum > 180
    ) {
      return res.status(400).json({ error: 'lat/lng must be valid numbers within range' });
    }

    try {
      const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          lat: latNum,
          lon: lngNum,
          appid: apiKey,
          units: 'metric',
        },
        timeout: 10000,
      });

      const data = response.data;
      const wind = data.wind || {};
      res.json({
        wind_speed: wind.speed ?? null,
        wind_deg: wind.deg ?? null,
        gust: wind.gust ?? null,
        location: data.name || null,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (err) {
      // Don't leak upstream error details (could include the API key via URL in some axios error messages)
      const status = err.response?.status === 401 || err.response?.status === 404 ? 502 : 502;
      console.error('Weather fetch failed:', err.response?.status, err.response?.statusText || err.message);
      res.status(status).json({ error: 'Weather fetch failed' });
    }
  });

  router.get('/pins', (req, res) => {
    try {
      const pins = pinService.getAll();
      res.json(pins);
    } catch (err) {
      console.error('Failed to fetch pins:', err);
      res.status(500).json({ error: 'Failed to fetch pins' });
    }
  });

  router.post('/pins', (req, res) => {
    const { name, lat, lng, imageUrl } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
      return res.status(422).json({ error: 'name is required (1-255 chars)' });
    }
    if (typeof lat !== 'number' || Number.isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(422).json({ error: 'lat must be a number between -90 and 90' });
    }
    if (typeof lng !== 'number' || Number.isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(422).json({ error: 'lng must be a number between -180 and 180' });
    }
    if (imageUrl != null) {
      if (typeof imageUrl !== 'string' || imageUrl.length > 2000) {
        return res.status(422).json({ error: 'imageUrl must be a string (max 2000 chars)' });
      }
      try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(422).json({ error: 'imageUrl must use http or https' });
        }
      } catch {
        return res.status(422).json({ error: 'imageUrl must be a valid URL' });
      }
    }

    try {
      const pin = pinService.create({ name: name.trim(), lat, lng, imageUrl });
      res.status(201).json(pin);
    } catch (err) {
      console.error('Failed to create pin:', err);
      res.status(500).json({ error: 'Failed to create pin' });
    }
  });

  router.delete('/pins/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0 || String(id) !== req.params.id) {
      return res.status(400).json({ error: 'Invalid pin ID' });
    }

    try {
      const deleted = pinService.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Pin not found' });
      }
      res.json({ message: 'Pin deleted' });
    } catch (err) {
      console.error('Failed to delete pin:', err);
      res.status(500).json({ error: 'Failed to delete pin' });
    }
  });

  return router;
}

module.exports = { createRoutes };