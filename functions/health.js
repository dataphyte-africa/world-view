import { json } from '../src/pages-lib.js';

export function onRequestGet() {
  return json(200, {
    status: 'ok',
    timestamp: Math.floor(Date.now() / 1000),
    version: '1.0.0',
  });
}
