'use strict';

const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

let _cache = null; // { access_token, token_type, expires_in, expiresAt, source }

async function getAdobeAccessToken() {
  // Env-override: skip OAuth entirely
  const envToken = process.env.AEP_ACCESS_TOKEN;
  if (envToken) {
    return { access_token: envToken, token_type: 'bearer', expires_in: null, source: 'env' };
  }

  // Validate required vars
  const required = ['AEP_CLIENT_ID', 'AEP_CLIENT_SECRET', 'AEP_SCOPES'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    const err = new Error(`Missing required env vars: ${missing.join(', ')}`);
    err.statusCode = 500;
    err.missing = missing;
    throw err;
  }

  // Return cached token if still valid
  if (_cache && Date.now() < _cache.expiresAt - EXPIRY_BUFFER_MS) {
    return _cache;
  }

  const { AEP_CLIENT_ID, AEP_CLIENT_SECRET, AEP_SCOPES } = process.env;

  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AEP_CLIENT_ID,
      client_secret: AEP_CLIENT_SECRET,
      scope: AEP_SCOPES,
    }).toString(),
  });

  if (!res.ok) throw new Error(`IMS ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token in IMS response: ${JSON.stringify(data)}`);

  const expiresAt = Date.now() + data.expires_in * 1000;
  const minsUntilExpiry = Math.round((expiresAt - Date.now()) / 60000);
  console.error(`[adobe-auth] Token refreshed (source: oauth_server_to_server). Expires in ~${minsUntilExpiry} min.`);

  _cache = { access_token: data.access_token, token_type: data.token_type, expires_in: data.expires_in, expiresAt, source: 'oauth_server_to_server' };
  return _cache;
}

module.exports = { getAdobeAccessToken };
