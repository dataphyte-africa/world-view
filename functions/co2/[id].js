import { json } from '../../src/pages-lib.js';
import { updateCo2, deleteCo2 } from '../../src/d1co2.js';

function parseOptionalText(value, max) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > max) return null;
  return value;
}

export const onRequestPut = async function ({ request, params, env }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id) || id <= 0) {
    return json(400, { error: 'Invalid CO2 source ID' });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { operator, location, description, imageUrl } = body || {};
  const operatorText = parseOptionalText(operator, 255);
  const locationText = parseOptionalText(location, 255);
  const descriptionText = parseOptionalText(description, 4000);
  const imageUrlText = parseOptionalText(imageUrl, 2000);
  if (operatorText === null || locationText === null || descriptionText === null || imageUrlText === null) {
    return json(422, { error: 'operator (255), location (255), description (4000) and imageUrl (2000) must be strings within limits' });
  }
  if (imageUrlText) {
    try {
      const parsed = new URL(imageUrlText);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return json(422, { error: 'imageUrl must use http or https' });
      }
    } catch {
      return json(422, { error: 'imageUrl must be a valid URL' });
    }
  }

  try {
    const source = await updateCo2(env, id, {
      operator: operatorText,
      location: locationText,
      description: descriptionText,
      imageUrl: imageUrlText,
    });
    if (!source) {
      return json(404, { error: 'CO2 source not found' });
    }
    return json(200, source);
  } catch (err) {
    return json(500, { error: 'Failed to update CO2 source' });
  }
};

export const onRequestDelete = async function ({ params, env }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id) || id <= 0) {
    return json(400, { error: 'Invalid CO2 source ID' });
  }

  try {
    const deleted = await deleteCo2(env, id);
    if (!deleted) {
      return json(404, { error: 'CO2 source not found' });
    }
    return json(200, { message: 'CO2 source deleted' });
  } catch (err) {
    return json(500, { error: 'Failed to delete CO2 source' });
  }
};
