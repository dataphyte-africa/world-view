require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createRoutes } = require('./src/routes');
const { KmlParser } = require('./src/services/KmlParser');
const { createPinService } = require('./src/services/PinService');
const { createCo2Service } = require('./src/services/Co2Service');
const { DEFAULT_CO2_SOURCES } = require('./src/co2-sources');

async function createApp() {
  const app = express();
  const prefix = process.env.WORLDVIEW_ROUTE_PREFIX || 'world-view';

  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
  app.use(express.static(path.join(__dirname, 'public')));

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'resources/views'));

  const dbPath = process.env.WORLDVIEW_DB_PATH
    ? path.resolve(__dirname, process.env.WORLDVIEW_DB_PATH)
    : path.join(__dirname, 'data', 'worldview.db');
  const pinService = createPinService({ dbPath });
  await pinService.init();

  const co2Service = createCo2Service({ dbPath });
  await co2Service.init();
  await co2Service.ensureSeeded(DEFAULT_CO2_SOURCES);

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
    pinsEnabled: true,
    kmlFeatures,
    kmlBounds,
    pins: [],
    routePrefix: prefix,
    weatherEnabled: !!process.env.WORLDVIEW_OWM_KEY,
    weatherInterval: parseInt(process.env.WORLDVIEW_WEATHER_INTERVAL || '60000', 10),
    assetUrl: '/assets',
  });

  const routes = createRoutes(pinService, co2Service, kmlParser, prefix);
  app.use(`/${prefix}`, routes);

  app.get('/', (req, res) => {
    res.render('index', { config: getConfig(), prefix });
  });

  return app;
}

if (require.main === module) {
  createApp()
    .then(app => {
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`WorldView server running at http://localhost:${PORT}`);
        console.log(`Map available at http://localhost:${PORT}/${process.env.WORLDVIEW_ROUTE_PREFIX || 'world-view'}`);
      });
    })
    .catch(err => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = { createApp };
