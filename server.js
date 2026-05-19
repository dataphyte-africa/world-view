const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');

const AIS_STREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const AIS_API_KEY = process.env.AIS_API_KEY || '160ba5cd62df97cdc248d135cfd71c2b01103942';

const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const marineWss = new WebSocket.Server({ server, path: '/marine' });
let aisSocket = null;
const marineClients = new Set();

function broadcastMarine(data) {
  const payload = JSON.stringify(data);
  for (const client of marineClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    } else {
      marineClients.delete(client);
    }
  }
}

function createAisSocket() {
  aisSocket = new WebSocket(AIS_STREAM_URL);
  aisSocket.on('open', () => {
    const subscriptionMessage = {
      Apikey: AIS_API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
    };
    aisSocket.send(JSON.stringify(subscriptionMessage));
  });

  aisSocket.on('message', (event) => {
    try {
      const payload = JSON.parse(event.toString());
      broadcastMarine(payload);
    } catch (err) {
      console.warn('[AIS] Failed to parse message', err.message);
    }
  });

  aisSocket.on('close', () => {
    console.warn('[AIS] Connection closed, reconnecting in 5s');
    setTimeout(createAisSocket, 5000);
  });

  aisSocket.on('error', (err) => {
    console.warn('[AIS] Socket error:', err.message);
  });
}

createAisSocket();

marineWss.on('connection', (ws) => {
  marineClients.add(ws);
  ws.send(JSON.stringify({ type: 'marine:connected' }));
  ws.on('close', () => marineClients.delete(ws));
  ws.on('error', () => marineClients.delete(ws));
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/cesium', express.static(path.join(__dirname, 'node_modules', 'cesium', 'Build', 'Cesium')));

function buildUrlWithParams(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.append(key, value);
  });
  return url.toString();
}

app.get('/api/opensky/:path(.*)', async (req, res) => {
  const path = req.params.path || 'api/states/all';
  const cleanPath = path.startsWith('api/') ? path : `api/${path}`;
  const targetUrl = buildUrlWithParams(`https://opensky-network.org/${cleanPath}`, req.query);

  try {
    const response = await fetch(targetUrl, { headers: { Accept: 'application/json' } });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    res.status(response.status).send(data);
  } catch (err) {
    res.status(502).json({ error: 'OpenSky proxy failed', message: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

server.listen(PORT, () => {
  console.log(`WorldView server running at http://localhost:${PORT}`);
});