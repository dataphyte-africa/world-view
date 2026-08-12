import { getConfig, renderIndex } from '../src/pages-lib.js';

export function onRequestGet({ env }) {
  const html = renderIndex(getConfig(env));
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
