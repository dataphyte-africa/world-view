const axios = require('axios');

const AUTH_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const API_BASE = 'https://opensky-network.org';
const TIMEOUT = 15000;

class OpenSkyService {
  constructor() {
    this.http = axios.create({ timeout: TIMEOUT });
    this._token = null;
    this._tokenExpiry = 0;
  }

  async getToken() {
    const now = Date.now();
    if (this._token && this._tokenExpiry > now + 60000) {
      return this._token;
    }

    const clientId = process.env.OPENSKY_CLIENT_ID;
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET must be set');
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);

      const response = await this.http.post(AUTH_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const data = response.data;
      const token = data.access_token;
      if (!token) {
        throw new Error('No access_token in OpenSky auth response');
      }

      const expiresIn = data.expires_in || 300;
      this._token = token;
      this._tokenExpiry = now + (expiresIn - 60) * 1000;

      return token;
    } catch (err) {
      console.error('[OpenSky] Auth failed:', err.message);
      throw new Error('OpenSky authentication failed: ' + err.message);
    }
  }

  isValidPath(path) {
    return path.length > 0
      && path.length < 200
      && !path.includes('..')
      && /^[a-zA-Z0-9_\/\-.?&=]+$/.test(path);
  }

  async proxy(path, query = {}) {
    let cleanPath = path.replace(/^\/+/, '');
    if (!cleanPath.startsWith('api/')) {
      cleanPath = 'api/' + cleanPath;
    }

    if (!this.isValidPath(cleanPath)) {
      throw new Error('Invalid path');
    }

    let url = `${API_BASE}/${cleanPath}`;

    const headers = { Accept: 'application/json' };

    try {
      const token = await this.getToken();
      headers['Authorization'] = 'Bearer ' + token;
    } catch (e) {
      console.warn('[OpenSky] Proceeding anonymously:', e.message);
    }

    try {
      const response = await this.http.get(url, {
        headers,
        params: query,
      });

      return {
        status: response.status,
        data: response.data,
      };
    } catch (err) {
      console.error('[OpenSky] Proxy failed:', err.message);
      throw new Error('OpenSky proxy request failed: ' + err.message);
    }
  }
}

module.exports = { OpenSkyService };
