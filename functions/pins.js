import { json } from '../src/pages-lib.js';
import { getAll, createPin } from '../src/d1pins.js';

export const onRequestGet = async function ({ env }) {
  try {
    const pins = await getAll(env);
    return json(200, pins);
  } catch (err) {
    return json(500, { error: 'Failed to load pins' });
  }
};

export const onRequestPost = async function ({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { name, lat, lng, imageUrl } = body || {};

  if (!name || typeof name !== 'string' || name.length > 255) {
    return json(422, { error: 'name is required (max 255 chars)' });
  }
  if (lat == null || typeof lat !== 'number' || lat < -90 || lat > 90) {
    return json(422, { error: 'lat must be a number between -90 and 90' });
  }
  if (lng == null || typeof lng !== 'number' || lng < -180 || lng > 180) {
    return json(422, { error: 'lng must be a number between -180 and 180' });
  }
  if (imageUrl && (typeof imageUrl !== 'string' || imageUrl.length > 2000)) {
    return json(422, { error: 'imageUrl must be a string (max 2000 chars)' });
  }

  try {
    const pin = await createPin(env, { name, lat, lng, imageUrl });
    return json(201, pin);
  } catch (err) {
    return json(500, { error: 'Failed to create pin' });
  }
};
