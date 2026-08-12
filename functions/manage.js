import { renderAdmin } from '../src/renderAdmin.js';

export function onRequestGet() {
  const html = renderAdmin({ routePrefix: '' });
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
