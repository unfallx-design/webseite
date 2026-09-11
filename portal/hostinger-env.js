'use strict';
const fs = require('node:fs');
const {parseEnv} = require('node:util');

// Hostinger's shared Passenger subdomains do not always receive newly added
// hPanel variables. Read only the Google pair from the private hosting config.
// The file stays outside the web root; injected configuration takes precedence.
function loadHostingerGoogleEnv(appDir, env = process.env, read = fs.readFileSync) {
  if (env.NODE_ENV === 'test' || (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) return false;
  const deployment = String(appDir).match(/^(\/home\/u\d+\/domains\/unfallx\.com\/hbuilds)\/(?:current|versions\/[a-zA-Z0-9-]+)\/nodejs$/);
  if (!deployment) return false;
  try {
    const values = parseEnv(read(deployment[1] + '/config/.env', 'utf8'));
    if (!values.GOOGLE_CLIENT_ID || !values.GOOGLE_CLIENT_SECRET) return false;
    const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    // Never accidentally combine credentials belonging to different clients.
    if (keys.some(key => env[key] && env[key] !== values[key])) return false;
    for (const key of keys) if (!env[key]) env[key] = values[key];
    return true;
  } catch {
    // A missing private config must not take password login or uploads offline.
    // Never log file contents, credentials or parser errors.
    return false;
  }
}

module.exports = {loadHostingerGoogleEnv};
