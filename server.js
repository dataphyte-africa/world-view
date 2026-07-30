require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createRoutes } = require('./src/routes');
const { KmlParser } = require('./src/services/KmlParser');
const { PinService } = require('./src/services/PinService');

async function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const prefix = process.env.WORLDVIEW_ROUTE_PREFIX || 'world-view';

  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, 'resources/assets')));

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'resources/views'));

  const dbPath = path.join(__dirname, 'data', 'worldview.db');
  const pinService = new PinService(dbPath);
  await pinService.init();

  const kmlParser = new KmlParser();

  const kmlPath = process.env.WORLDVIEW_KML_PATH
    ? path.resolve(__dirname, process.env.WORLDVIEW_KML_PATH)
    : path.join(__dirname, 'data', 'locations.kml');

  let kmlFeatures = [];
  let kmlBounds = null;

  if (fs.existsSync(kmlPath)) {
    kmlFeatures = kmlParser.parseFile(kmlPath);
    if (kmlFeatures.length > 0) {
      const lats = kmlFeatures.map(f => f.latitude);
      const lngs = kmlFeatures.map(f => f.longitude);
      kmlBounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };
    }
    console.log(`WorldView: Loaded ${kmlFeatures.length} KML features from ${kmlPath}`);
  }

  const getConfig = () => ({
    aircraftEnabled: process.env.WORLDVIEW_AIRCRAFT_ENABLED === 'true',
    pinsEnabled: true,
    kmlFeatures,
    kmlBounds,
    pins: [],
    routePrefix: prefix,
    fetchInterval: parseInt(process.env.WORLDVIEW_AIRCRAFT_INTERVAL || '15000', 10),
    maxAircraft: parseInt(process.env.WORLDVIEW_MAX_AIRCRAFT || '1000', 10),
    weatherEnabled: !!process.env.WORLDVIEW_OWM_KEY,
    assetUrl: '/assets',
  });

  const routes = createRoutes(pinService, kmlParser, prefix);
  app.use(`/${prefix}`, routes);

  app.get('/', (req, res) => {
    res.render('index', { config: getConfig(), prefix });
  });

  app.listen(PORT, () => {
    console.log(`WorldView server running at http://localhost:${PORT}`);
    console.log(`Map available at http://localhost:${PORT}/${prefix}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
