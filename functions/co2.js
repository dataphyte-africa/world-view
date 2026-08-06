const { json } = require('../src/pages-lib');
const { getAll, ensureSeeded } = require('../src/d1co2');
const { DEFAULT_CO2_SOURCES } = require('../src/co2-sources');

module.exports.onRequestGet = async function ({ env }) {
  try {
    await ensureSeeded(env, DEFAULT_CO2_SOURCES);
    const sources = await getAll(env);
    return json(200, sources);
  } catch (err) {
    return json(500, { error: 'Failed to load CO2 sources' });
  }
};
