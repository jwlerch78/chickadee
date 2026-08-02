// SPDX-License-Identifier: AGPL-3.0-only
// config.js — runtime configuration: data paths + Chickadee environment.
//
// Chickadee accounts are hosted on the same backend that powers Chickadee
// (one shared account system, by design — the relationship is documented in
// PROVENANCE.md and disclosed on the console's sign-in footer). The anon keys
// below are public-by-design (the browser-shipped Supabase anon role; RLS and
// edge-function auth enforce access, not key secrecy).

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = fs.existsSync('/data') && fs.statSync('/data').isDirectory()
    ? '/data'
    : path.resolve(__dirname, '..', 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* exists */ }

// NO HOSTED ENVIRONMENT IN THIS BUILD. The shape is kept because callers read
// .url/.anonKey off the selected environment, so removing it would turn a dead
// lane into a TypeError; blank values fail CLOSED instead. Self-policing, like
// the integration's brain seam: miss this substitution and the real project URL
// survives into a public tree, which is exactly what the deny scan fails on.
const ENVIRONMENTS = {
    beta: { url: '', anonKey: '', verificationBase: '' },
    stable: { url: '', anonKey: '', verificationBase: '' },
};
const ENV_ALIASES = { development: 'beta', production: 'stable' };

// Environment comes from the add-on option (Configuration tab), read once at
// process start — changing it requires an add-on restart, which is the natural
// moment anyway (credentials are per-environment).
let envName = 'beta';
try {
    const opts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'options.json'), 'utf8'));
    const requested = ENV_ALIASES[opts.cloud_env] || opts.cloud_env;
    if (ENVIRONMENTS[requested]) envName = requested;
} catch { /* defaults */ }

// Add-on version — single source is package.json (bumped by scripts/release.sh
// together with config.yaml, so /api/ping can't go stale again).
let version = '0.0.0';
try { version = require('../package.json').version; } catch { /* dev tree */ }

module.exports = {
    DATA_DIR,
    CLOUD_ENV: envName,
    CLOUD: ENVIRONMENTS[envName],
    JWT_FILE: path.join(DATA_DIR, 'dashie_ha_auth.json'),
    // The vendored Chickadee console SPA (scripts/sync-console.sh).
    FRONTEND_DIR: path.resolve(__dirname, '..', 'frontend', 'console'),
    PORT: parseInt(process.env.INGRESS_PORT || process.env.PORT || '8099', 10),
    VERSION: version,
};
