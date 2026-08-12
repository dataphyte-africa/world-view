import { json } from '../../src/pages-lib.js';
import { deletePin } from '../../src/d1pins.js';

export const onRequestDelete = async function ({ params, env }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return json(400, { error: 'Invalid pin ID' });
  }

  try {
    const deleted = await deletePin(env, id);
    if (!deleted) {
      return json(404, { error: 'Pin not found' });
    }
    return json(200, { message: 'Pin deleted' });
  } catch (err) {
    return json(500, { error: 'Failed to delete pin' });
  }
};
