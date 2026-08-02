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

// Capability-lease TTL (CONTRACTS #65). Config, not a constant, because the
// revocation window is an operational dial: shorter means a sharing flip takes
// effect sooner, at the cost of more LAN chatter. 30 min is the default (D3);
// LAN traffic is free, so the floor is generous and the ceiling is what bounds
// the worst-case revocation delay.
//
// Clamped rather than trusted: a 0 would mean a lease that expires on arrival
// (every satellite permanently destroyed), and a huge value would make the
// revocation window unbounded — the exact thing the lease exists to bound.
let leaseTtlS = 30 * 60;
let leaseTtlIsDebug = false;
try {
    const opts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'options.json'), 'utf8'));
    const mins = Number(opts.lease_ttl_minutes);
    if (Number.isFinite(mins)) leaseTtlS = Math.min(Math.max(Math.round(mins), 5), 240) * 60;

    // DEBUG OVERRIDE, seconds — declared in the DEV channel's schema ONLY, so on
    // the prod channel Home Assistant rejects the option before it reaches us.
    // That is the whole enforcement: no code branch, no flavour check, and no way
    // to leave a 60-second revocation window running in a household by accident.
    //
    // It exists because the real 30-minute TTL prices the lease test suite like a
    // soak — 3+ hours a run — and a suite that expensive is one that stops being
    // run, which is how a revocation mechanism silently rots. At 60s the same
    // suite is minutes. (Thread T's requirement, and its reasoning.)
    const secs = Number(opts.lease_ttl_seconds);
    if (Number.isFinite(secs) && secs > 0) {
        leaseTtlS = Math.min(Math.max(Math.round(secs), 10), 240 * 60);
        leaseTtlIsDebug = true;
    }
} catch { /* default */ }

// Add-on version — single source is package.json (bumped by scripts/release.sh
// together with config.yaml, so /api/ping can't go stale again).
let version = '0.0.0';
try { version = require('../package.json').version; } catch { /* dev tree */ }

module.exports = {
    DATA_DIR,
    CLOUD_ENV: envName,
    CLOUD: ENVIRONMENTS[envName],
    LEASE_TTL_S: leaseTtlS,
    LEASE_TTL_IS_DEBUG: leaseTtlIsDebug,
    JWT_FILE: path.join(DATA_DIR, 'dashie_ha_auth.json'),
    // The vendored Chickadee console SPA (scripts/sync-console.sh).
    FRONTEND_DIR: path.resolve(__dirname, '..', 'frontend', 'console'),
    PORT: parseInt(process.env.INGRESS_PORT || process.env.PORT || '8099', 10),
    VERSION: version,
};
