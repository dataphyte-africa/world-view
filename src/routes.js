const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { OpenSkyService } = require('./services/OpenSkyService');

function createRoutes(pinService, kmlParser, prefix) {
  const router = express.Router();
  const openSky = new OpenSkyService();

  const rateLimitMax = parseInt(process.env.WORLDVIEW_RATE_LIMIT || '30', 10);
  const limiter = rateLimit({
    windowMs: 60000,
    max: rateLimitMax,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => 'worldview:' + (req.ip || req.connection.remoteAddress),
  });

  router.get('/', (req, res) => {
    res.redirect('/' + prefix);
  });

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0.0',
      aircraft_enabled: process.env.WORLDVIEW_AIRCRAFT_ENABLED === 'true',
    });
  });

  router.get('/opensky/*', limiter, async (req, res) => {
    if (process.env.WORLDVIEW_AIRCRAFT_ENABLED !== 'true') {
      return res.status(404).json({ error: 'Aircraft tracking is disabled' });
    }

    const path = req.params[0] || req.path.replace(/^\/opensky\//, '');
    try {
      const result = await openSky.proxy(path, req.query);
      return res.status(result.status).json(result.data);
    } catch (err) {
      if (err.message === 'Invalid path') {
        return res.status(400).json({ error: err.message });
      }
      return res.status(502).json({ error: err.message });
    }
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

    try {
      const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          lat,
          lon: lng,
          appid: apiKey,
          units: 'metric',
        },
        timeout: 10000,
      });

      const data = response.data;
      const wind = data.wind || {};

      res.json({
        wind_speed: wind.speed || null,
        wind_deg: wind.deg || null,
        gust: wind.gust || null,
        location: data.name || null,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (err) {
      res.status(502).json({ error: 'Weather fetch failed: ' + err.message });
    }
  });

  router.get('/pins', (req, res) => {
    const pins = pinService.getAll();
    res.json(pins);
  });

  router.post('/pins', (req, res) => {
    const { name, lat, lng, imageUrl } = req.body;

    if (!name || typeof name !== 'string' || name.length > 255) {
      return res.status(422).json({ error: 'name is required (max 255 chars)' });
    }
    if (lat == null || typeof lat !== 'number' || lat < -90 || lat > 90) {
      return res.status(422).json({ error: 'lat must be a number between -90 and 90' });
    }
    if (lng == null || typeof lng !== 'number' || lng < -180 || lng > 180) {
      return res.status(422).json({ error: 'lng must be a number between -180 and 180' });
    }
    if (imageUrl && (typeof imageUrl !== 'string' || imageUrl.length > 2000)) {
      return res.status(422).json({ error: 'imageUrl must be a string (max 2000 chars)' });
    }

    try {
      const pin = pinService.create({ name, lat, lng, imageUrl });
      res.status(201).json(pin);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create pin' });
    }
  });

  router.delete('/pins/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid pin ID' });
    }

    const deleted = pinService.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    res.json({ message: 'Pin deleted' });
  });

  return router;
}

module.exports = { createRoutes };
